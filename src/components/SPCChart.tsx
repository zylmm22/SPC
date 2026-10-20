import React, { useState, useMemo } from 'react';
import { 
  SubgroupDataPoint, 
  ControlLimits, 
  ProcessCharacteristic, 
  SPCChartType,
  AuditLevelMode,
  CNAuditConfig,
  GJBAuditConfig
} from '../types/spc';
import { NELSON_8_RULES } from '../utils/spcConstants';
import { 
  AlertTriangle, 
  CheckCircle2, 
  EyeOff, 
  Info, 
  Sliders, 
  Maximize2, 
  RotateCcw,
  Sparkles,
  Activity,
  Award,
  ShieldCheck,
  Settings,
  Lock,
  Eye
} from 'lucide-react';

interface SPCChartProps {
  process: ProcessCharacteristic;
  subgroups: SubgroupDataPoint[];
  limits: ControlLimits;
  enabledRules: number[];
  onToggleRule: (ruleId: number) => void;
  onToggleAllRules: (enable: boolean) => void;
  onVoidSubgroup: (subgroupId: string, reason?: string) => void;
  onRestoreSubgroup: (subgroupId: string) => void;
  auditMode?: AuditLevelMode;
  cnConfig?: CNAuditConfig;
  gjbConfig?: GJBAuditConfig;
  onOpenAuditModal?: (type: 'cn' | 'gjb') => void;
  onSwitchAuditMode?: (mode: AuditLevelMode) => void;
  isAdmin?: boolean;
}

export const SPCChart: React.FC<SPCChartProps> = ({
  process,
  subgroups,
  limits,
  enabledRules,
  onToggleRule,
  onToggleAllRules,
  onVoidSubgroup,
  onRestoreSubgroup,
  auditMode = 'real',
  cnConfig,
  gjbConfig,
  onOpenAuditModal,
  onSwitchAuditMode,
  isAdmin = true,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<SubgroupDataPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<SubgroupDataPoint | null>(null);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showSpecLimits, setShowSpecLimits] = useState<boolean>(true);
  const [voidReasonInput, setVoidReasonInput] = useState<string>('');

  const isDualChart = ['xbar-r', 'xbar-s', 'i-mr'].includes(process.chartType);

  // 统计异常情况
  const violationStats = useMemo(() => {
    let violationCount = 0;
    const ruleHits: Record<number, number> = {};
    
    subgroups.forEach(sg => {
      if (sg.violations && sg.violations.length > 0) {
        violationCount++;
        sg.violations.forEach(v => {
          ruleHits[v.ruleId] = (ruleHits[v.ruleId] || 0) + 1;
        });
      }
    });

    const voidedCount = subgroups.filter(s => s.isVoided).length;

    return {
      total: subgroups.length,
      violationCount,
      voidedCount,
      ruleHits,
      isControlled: violationCount === 0
    };
  }, [subgroups]);

  // SVG 画布尺寸配置
  const svgWidth = 980;
  const mainHeight = isDualChart ? 280 : 360;
  const subHeight = isDualChart ? 180 : 0;
  const padding = { top: 25, right: 90, bottom: 35, left: 65 };

  // 绘图区域有效尺寸
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotMainHeight = mainHeight - padding.top - padding.bottom;
  const plotSubHeight = subHeight - padding.top - padding.bottom;

  // 主图 Y 轴范围计算
  const mainYRange = useMemo(() => {
    const mainValues = subgroups.map(s => s.mean);
    const ucl = limits.ucl;
    const lcl = limits.lcl;
    const cl = limits.cl;
    const usl = showSpecLimits && process.usl !== undefined ? process.usl : ucl;
    const lsl = showSpecLimits && process.lsl !== undefined ? process.lsl : lcl;

    const allY = [...mainValues, ucl, lcl, cl, usl, lsl].filter(v => v !== undefined && !isNaN(v));
    const minVal = Math.min(...allY);
    const maxVal = Math.max(...allY);
    const span = maxVal - minVal || 1;
    const margin = span * 0.15;

    return {
      min: minVal - margin,
      max: maxVal + margin
    };
  }, [subgroups, limits, process, showSpecLimits]);

  // 副图 Y 轴范围计算 (R 或 S 或 MR)
  const subYRange = useMemo(() => {
    if (!isDualChart) return { min: 0, max: 1 };
    const subValues = subgroups.map(s => s.range ?? s.stdDev ?? s.movingRange ?? 0);
    const subUcl = limits.subUcl ?? 1;
    const subLcl = limits.subLcl ?? 0;
    const subCl = limits.subCl ?? 0.5;

    const allY = [...subValues, subUcl, subLcl, subCl];
    const minVal = Math.min(...allY);
    const maxVal = Math.max(...allY);
    const span = maxVal - minVal || 1;
    const margin = span * 0.15;

    return {
      min: Math.max(0, minVal - margin * 0.5),
      max: maxVal + margin
    };
  }, [subgroups, limits, isDualChart]);

  // 坐标转换函数
  const getX = (index: number) => {
    if (subgroups.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (subgroups.length - 1)) * plotWidth;
  };

  const getMainY = (val: number) => {
    const { min, max } = mainYRange;
    if (max === min) return padding.top + plotMainHeight / 2;
    const ratio = (val - min) / (max - min);
    return padding.top + plotMainHeight - ratio * plotMainHeight;
  };

  const getSubY = (val: number) => {
    const { min, max } = subYRange;
    if (max === min) return padding.top + plotSubHeight / 2;
    const ratio = (val - min) / (max - min);
    return padding.top + plotSubHeight - ratio * plotSubHeight;
  };

  // 主图标签与名称
  const chartLabels = useMemo(() => {
    switch (process.chartType) {
      case 'xbar-r':
        return { main: '均值 (X-bar) 控制图', sub: '极差 (R) 控制图', mainUnit: process.unit, subUnit: process.unit };
      case 'xbar-s':
        return { main: '均值 (X-bar) 控制图', sub: '标准差 (S) 控制图', mainUnit: process.unit, subUnit: process.unit };
      case 'i-mr':
        return { main: '单值 (I) 控制图', sub: '移动极差 (MR) 控制图', mainUnit: process.unit, subUnit: process.unit };
      case 'p':
        return { main: '不良率 (P) 控制图', sub: '', mainUnit: '%', subUnit: '' };
      case 'np':
        return { main: '不合格品数 (NP) 控制图', sub: '', mainUnit: '件', subUnit: '' };
      case 'c':
        return { main: '缺陷总数 (C) 控制图', sub: '', mainUnit: '个', subUnit: '' };
      case 'u':
        return { main: '单位缺陷数 (U) 控制图', sub: '', mainUnit: '个/件', subUnit: '' };
    }
  }, [process.chartType, process.unit]);

  const sigmaMain = (limits.ucl - limits.cl) / 3;

  return (
    <div className="space-y-4">
      {/* 审查审计专项工具栏：CN等级 与 国军标等级 按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-900/50 rounded-xl shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            审查模拟功能 (用于体系审查与抽检):
          </span>
          <div className="flex items-center gap-2">
            {/* 1. 真实数据 */}
            <button
              onClick={() => onSwitchAuditMode && onSwitchAuditMode('real')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                auditMode === 'real'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              真实原始数据
            </button>

            {/* 2. CN等级 按钮 */}
            <button
              onClick={() => {
                if (!cnConfig?.isConfigured) {
                  onOpenAuditModal && onOpenAuditModal('cn');
                } else {
                  onSwitchAuditMode && onSwitchAuditMode('cn');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                auditMode === 'cn'
                  ? 'bg-sky-600 text-white border border-sky-400 shadow-sky-600/30 ring-2 ring-sky-500/30'
                  : 'bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/80'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              CN等级
              {cnConfig?.isConfigured && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-sky-900 text-sky-200">
                  Cpk:{cnConfig.targetCpk}
                </span>
              )}
            </button>

            {/* 3. 国军标等级 按钮 */}
            <button
              onClick={() => {
                if (!gjbConfig?.isConfigured) {
                  onOpenAuditModal && onOpenAuditModal('gjb');
                } else {
                  onSwitchAuditMode && onSwitchAuditMode('gjb');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                auditMode === 'gjb'
                  ? 'bg-amber-600 text-white border border-amber-400 shadow-amber-600/30 ring-2 ring-amber-500/30'
                  : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              国军标等级
              {gjbConfig?.isConfigured && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-900 text-amber-200">
                  GJB:{gjbConfig.targetCpk}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 审查模式参数调整按钮 */}
        <div className="flex items-center gap-2">
          {auditMode !== 'real' && (
            <button
              onClick={() => onOpenAuditModal && onOpenAuditModal(auditMode)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-indigo-900/80 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              修改{auditMode === 'cn' ? 'CN等级' : '国军标'}审查参数
            </button>
          )}
        </div>
      </div>

      {/* 审查模式生效说明横幅 */}
      {auditMode !== 'real' && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          auditMode === 'cn' 
            ? 'bg-sky-950/40 border-sky-800/80 text-sky-200' 
            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <b>【{auditMode === 'cn' ? 'CN等级审查模拟模式' : '国军标等级审查模拟模式'} 已生效】</b>：
              子组数据已<b>抓取真实上传数据的生产批号、采集时间、工序、设备号等字段</b>；测量点已根据设定的 
              {auditMode === 'cn' 
                ? ` CPK 要求 (${cnConfig?.targetCpk}) 与控制上下限 [${cnConfig?.lcl}, ${cnConfig?.ucl}] ` 
                : ` 国军标高可靠性标准 (Cpk=${gjbConfig?.targetCpk}) `}
              自动反推合成完美受控图表。
            </span>
          </div>
          <button
            onClick={() => onSwitchAuditMode && onSwitchAuditMode('real')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] shrink-0 ml-2"
          >
            退出审查切回真实数据
          </button>
        </div>
      )}

      {/* 顶部监控状态指示看板 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg flex items-center justify-center ${
            violationStats.isControlled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            {violationStats.isControlled ? <CheckCircle2 className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6 animate-bounce" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">{process.name}</h3>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {chartLabels.main}
              </span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                violationStats.isControlled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {violationStats.isControlled ? '● 制程受控' : `● 检测到异常点 (${violationStats.violationCount})`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              工序: {process.processName} | 子组聚合: 生产批号 (共 {subgroups.length} 批次) | 
              {violationStats.voidedCount > 0 && <span className="text-amber-400 ml-1">已剔除 {violationStats.voidedCount} 个作废子组</span>}
            </p>
          </div>
        </div>

        {/* 控制图辅助显示开关 */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              showZones ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {showZones ? '显示 1σ/2σ/3σ 区域' : '隐藏 1σ/2σ 区域'}
          </button>
          {process.usl !== undefined && (
            <button
              onClick={() => setShowSpecLimits(!showSpecLimits)}
              className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                showSpecLimits ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {showSpecLimits ? '显示规格限(USL/LSL)' : '隐藏规格限'}
            </button>
          )}
        </div>
      </div>

      {/* Nelson 8 大判异准则实时勾选配置栏 */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Nelson 8 大判异准则 (勾选实时判异)
            </span>
            <span className="text-xs text-slate-400 font-normal">
              已启用 {enabledRules.length}/8 项规则
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleAllRules(true)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
            >
              全选
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => onToggleAllRules(false)}
              className="text-[11px] text-slate-400 hover:text-slate-300 underline"
            >
              全清
            </button>
          </div>
        </div>

        {/* 规则复选标签列表 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {NELSON_8_RULES.map(rule => {
            const isChecked = enabledRules.includes(rule.id);
            const hits = violationStats.ruleHits[rule.id] || 0;
            return (
              <label
                key={rule.id}
                title={rule.detail}
                className={`relative flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                  isChecked 
                    ? hits > 0 
                      ? 'bg-rose-950/40 border-rose-600/60 text-rose-200' 
                      : 'bg-indigo-950/40 border-indigo-700/60 text-slate-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleRule(rule.id)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="truncate font-medium">{rule.shortDesc}</span>
                </div>
                {hits > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                    {hits}次
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* SVG 控制图主体区域 */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${mainHeight + (isDualChart ? subHeight + 15 : 0)}`}
          className="w-full h-auto select-none font-sans"
        >
          <defs>
            {/* 背景网格微光 */}
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            {/* 渐变遮罩 */}
            <linearGradient id="zoneAGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="zoneCGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* ======================= 主图绘制 ======================= */}
          <g id="main-chart">
            {/* 绘图区背景网格 */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotMainHeight}
              fill="url(#grid)"
              className="rounded"
            />
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotMainHeight}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* 1σ/2σ/3σ 区域背景色块 */}
            {showZones && sigmaMain > 0 && (
              <>
                {/* Zone A: 2σ ~ 3σ 上方 */}
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl + 3 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl + 2 * sigmaMain) - getMainY(limits.cl + 3 * sigmaMain))}
                  fill="url(#zoneAGradient)"
                />
                {/* Zone A: -2σ ~ -3σ 下方 */}
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl - 2 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl - 3 * sigmaMain) - getMainY(limits.cl - 2 * sigmaMain))}
                  fill="url(#zoneAGradient)"
                />
                {/* Zone C: 中心线两侧 1σ 核心区 */}
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl + 1 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl - 1 * sigmaMain) - getMainY(limits.cl + 1 * sigmaMain))}
                  fill="url(#zoneCGradient)"
                />
                {/* 1σ/2σ 辅助线 */}
                <line
                  x1={padding.left}
                  y1={getMainY(limits.cl + 2 * sigmaMain)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(limits.cl + 2 * sigmaMain)}
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                  strokeDasharray="2,3"
                  strokeOpacity="0.4"
                />
                <line
                  x1={padding.left}
                  y1={getMainY(limits.cl + 1 * sigmaMain)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(limits.cl + 1 * sigmaMain)}
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                  strokeDasharray="2,3"
                  strokeOpacity="0.3"
                />
                <line
                  x1={padding.left}
                  y1={getMainY(limits.cl - 1 * sigmaMain)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(limits.cl - 1 * sigmaMain)}
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                  strokeDasharray="2,3"
                  strokeOpacity="0.3"
                />
                <line
                  x1={padding.left}
                  y1={getMainY(limits.cl - 2 * sigmaMain)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(limits.cl - 2 * sigmaMain)}
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                  strokeDasharray="2,3"
                  strokeOpacity="0.4"
                />
              </>
            )}

            {/* 规格界限 (USL / LSL) */}
            {showSpecLimits && process.usl !== undefined && (
              <>
                <line
                  x1={padding.left}
                  y1={getMainY(process.usl)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(process.usl)}
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="4,3"
                />
                <text
                  x={padding.left + plotWidth + 6}
                  y={getMainY(process.usl) + 4}
                  fill="#c084fc"
                  fontSize="10"
                  fontWeight="600"
                >
                  USL: {process.usl}
                </text>
              </>
            )}
            {showSpecLimits && process.lsl !== undefined && (
              <>
                <line
                  x1={padding.left}
                  y1={getMainY(process.lsl)}
                  x2={padding.left + plotWidth}
                  y2={getMainY(process.lsl)}
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="4,3"
                />
                <text
                  x={padding.left + plotWidth + 6}
                  y={getMainY(process.lsl) + 4}
                  fill="#c084fc"
                  fontSize="10"
                  fontWeight="600"
                >
                  LSL: {process.lsl}
                </text>
              </>
            )}

            {/* 控制限基准线: UCL, CL, LCL */}
            {/* UCL 线 */}
            <line
              x1={padding.left}
              y1={getMainY(limits.ucl)}
              x2={padding.left + plotWidth}
              y2={getMainY(limits.ucl)}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="5,4"
            />
            <text
              x={padding.left + plotWidth + 6}
              y={getMainY(limits.ucl) + 4}
              fill="#ef4444"
              fontSize="11"
              fontWeight="bold"
            >
              UCL: {limits.ucl}
            </text>

            {/* CL 线 */}
            <line
              x1={padding.left}
              y1={getMainY(limits.cl)}
              x2={padding.left + plotWidth}
              y2={getMainY(limits.cl)}
              stroke="#10b981"
              strokeWidth="1.8"
            />
            <text
              x={padding.left + plotWidth + 6}
              y={getMainY(limits.cl) + 4}
              fill="#34d399"
              fontSize="11"
              fontWeight="bold"
            >
              CL: {limits.cl}
            </text>

            {/* LCL 线 */}
            <line
              x1={padding.left}
              y1={getMainY(limits.lcl)}
              x2={padding.left + plotWidth}
              y2={getMainY(limits.lcl)}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="5,4"
            />
            <text
              x={padding.left + plotWidth + 6}
              y={getMainY(limits.lcl) + 4}
              fill="#ef4444"
              fontSize="11"
              fontWeight="bold"
            >
              LCL: {limits.lcl}
            </text>

            {/* 变动样本量控制限阶梯线 (针对变动 n 的 P 图或 U 图) */}
            {limits.hasVariableLimits && limits.variableLimits && (
              <path
                d={limits.variableLimits.map((vl, idx) => {
                  const x = getX(idx);
                  const y = getMainY(vl.ucl);
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.2"
                strokeDasharray="3,3"
              />
            )}

            {/* 主图折线 (跳过作废点用虚线或分段连接) */}
            <path
              d={subgroups.map((sg, idx) => {
                const x = getX(idx);
                const y = getMainY(sg.mean);
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 主图数据点渲染 */}
            {subgroups.map((sg, idx) => {
              const x = getX(idx);
              const y = getMainY(sg.mean);
              const hasViolations = sg.violations && sg.violations.some(v => v.chartPart === 'main');
              const isSelected = selectedPoint?.id === sg.id;
              const isHovered = hoveredPoint?.id === sg.id;
              const isVoided = sg.isVoided;

              return (
                <g 
                  key={sg.id}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredPoint(sg)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => setSelectedPoint(sg)}
                >
                  {/* 点外光环 */}
                  {(hasViolations || isHovered || isSelected) && !isVoided && (
                    <circle
                      cx={x}
                      cy={y}
                      r={hasViolations ? 10 : 8}
                      fill={hasViolations ? '#ef4444' : '#38bdf8'}
                      fillOpacity={hasViolations ? 0.35 : 0.25}
                      className={hasViolations ? 'animate-ping' : ''}
                    />
                  )}

                  {/* 核心数据圆点 */}
                  {isVoided ? (
                    // 作废点样式：灰色空心 + 斜线划掉
                    <g opacity="0.6">
                      <circle cx={x} cy={y} r="5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />
                      <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke="#f43f5e" strokeWidth="1.5" />
                    </g>
                  ) : hasViolations ? (
                    // 异常点样式：鲜红实心 + 白边
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6.5 : 5.5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  ) : (
                    // 正常受控点样式：科技蓝
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6 : 4.5}
                      fill={isSelected ? '#38bdf8' : '#0ea5e9'}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* X 轴批次号/序号刻度 */}
                  {(idx % Math.ceil(subgroups.length / 12) === 0 || idx === subgroups.length - 1) && (
                    <text
                      x={x}
                      y={padding.top + plotMainHeight + 18}
                      fill="#94a3b8"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {sg.batchNo ? sg.batchNo.slice(-4) : `#${sg.seq}`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 左侧主图标题与单位 */}
            <text
              x={padding.left}
              y={padding.top - 8}
              fill="#f1f5f9"
              fontSize="12"
              fontWeight="bold"
            >
              {chartLabels.main} ({process.unit})
            </text>
          </g>

          {/* ======================= 副图绘制 (R / S / MR) ======================= */}
          {isDualChart && (
            <g id="sub-chart" transform={`translate(0, ${mainHeight + 15})`}>
              {/* 副图网格背景 */}
              <rect
                x={padding.left}
                y={padding.top}
                width={plotWidth}
                height={plotSubHeight}
                fill="url(#grid)"
              />
              <rect
                x={padding.left}
                y={padding.top}
                width={plotWidth}
                height={plotSubHeight}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
              />

              {/* 副图 UCL, CL, LCL */}
              {limits.subUcl !== undefined && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subUcl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subUcl)}
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,3"
                  />
                  <text
                    x={padding.left + plotWidth + 6}
                    y={getSubY(limits.subUcl) + 4}
                    fill="#ef4444"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    UCL: {limits.subUcl}
                  </text>
                </>
              )}

              {limits.subCl !== undefined && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subCl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subCl)}
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                  <text
                    x={padding.left + plotWidth + 6}
                    y={getSubY(limits.subCl) + 4}
                    fill="#34d399"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    CL: {limits.subCl}
                  </text>
                </>
              )}

              {limits.subLcl !== undefined && limits.subLcl > 0 && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subLcl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subLcl)}
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,3"
                  />
                  <text
                    x={padding.left + plotWidth + 6}
                    y={getSubY(limits.subLcl) + 4}
                    fill="#ef4444"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    LCL: {limits.subLcl}
                  </text>
                </>
              )}

              {/* 副图折线 */}
              <path
                d={subgroups.map((sg, idx) => {
                  const val = sg.range ?? sg.stdDev ?? sg.movingRange ?? 0;
                  const x = getX(idx);
                  const y = getSubY(val);
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 副图数据点 */}
              {subgroups.map((sg, idx) => {
                const val = sg.range ?? sg.stdDev ?? sg.movingRange ?? 0;
                const x = getX(idx);
                const y = getSubY(val);
                const isVoided = sg.isVoided;
                const isSelected = selectedPoint?.id === sg.id;

                return (
                  <g 
                    key={`sub-${sg.id}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedPoint(sg)}
                  >
                    {isVoided ? (
                      <circle cx={x} cy={y} r="4" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />
                    ) : (
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 5 : 3.8}
                        fill={isSelected ? '#c4b5fd' : '#8b5cf6'}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                    )}
                  </g>
                );
              })}

              {/* 副图标题 */}
              <text
                x={padding.left}
                y={padding.top - 8}
                fill="#f1f5f9"
                fontSize="12"
                fontWeight="bold"
              >
                {chartLabels.sub} ({process.unit})
              </text>
            </g>
          )}
        </svg>

        {/* 浮动悬停数据详情卡片 */}
        {hoveredPoint && (
          <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs text-slate-300 w-72 pointer-events-none z-20">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                子组 #{hoveredPoint.seq}
              </span>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900">
                {hoveredPoint.batchNo}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">采集时间:</span>
                <span className="font-mono text-slate-300">{hoveredPoint.sampleTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">设备号 / 工序:</span>
                <span className="text-slate-300">{hoveredPoint.deviceNo} ({hoveredPoint.processName})</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-400">子组均值 (Mean):</span>
                <span className="text-sky-400 font-mono text-sm">{hoveredPoint.mean} {process.unit}</span>
              </div>
              {hoveredPoint.range !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">极差 (Range):</span>
                  <span className="text-purple-400 font-mono">{hoveredPoint.range} {process.unit}</span>
                </div>
              )}
              {hoveredPoint.stdDev !== undefined && hoveredPoint.stdDev > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">样本标差 (S):</span>
                  <span className="text-purple-400 font-mono">{hoveredPoint.stdDev}</span>
                </div>
              )}
              {hoveredPoint.values && hoveredPoint.values.length > 0 && (
                <div className="pt-1 border-t border-slate-800/80">
                  <span className="text-slate-500 block mb-0.5">测量值点阵 (x1~x{hoveredPoint.values.length}):</span>
                  <div className="flex flex-wrap gap-1">
                    {hoveredPoint.values.map((v: number, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-800 text-[10px] font-mono rounded text-slate-200">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 违规报警描述 */}
            {hoveredPoint.violations && hoveredPoint.violations.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-rose-900/60 bg-rose-950/30 -mx-3 -mb-3 p-2.5 rounded-b-xl">
                <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px] mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  触发判异报警 ({hoveredPoint.violations.length} 条):
                </div>
                {hoveredPoint.violations.map((v: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-rose-300/90 leading-tight">
                    • {v.ruleName}: {v.description}
                  </div>
                ))}
              </div>
            )}

            {hoveredPoint.isVoided && (
              <div className="mt-2 text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" />
                已作废点: {hoveredPoint.voidReason || '不参与控制限重算'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 点击选定子组弹出操作抽屉/模态框 (支持查看测量点与作废/剔除重算) */}
      {selectedPoint && (
        <div className="p-4 bg-slate-900 border border-indigo-900/50 rounded-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">已选中子组:</span>
              <span className="text-sm font-semibold text-slate-100">序号 #{selectedPoint.seq}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                批号: {selectedPoint.batchNo}
              </span>
              <span className="text-xs text-slate-400">设备: {selectedPoint.deviceNo}</span>
              <span className="text-xs text-slate-400">时间: {selectedPoint.sampleTime}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span>子组均值: <b className="text-sky-400 font-mono">{selectedPoint.mean} {process.unit}</b></span>
              {selectedPoint.range !== undefined && <span>极差 R: <b className="text-purple-400 font-mono">{selectedPoint.range}</b></span>}
              {selectedPoint.stdDev !== undefined && <span>标准差 S: <b className="text-purple-400 font-mono">{selectedPoint.stdDev}</b></span>}
              <span>状态: {selectedPoint.isVoided ? <b className="text-amber-400">已作废 (不参与控制限)</b> : <b className="text-emerald-400">有效样本</b>}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              selectedPoint.isVoided ? (
                <button
                  onClick={() => {
                    onRestoreSubgroup(selectedPoint.id);
                    setSelectedPoint(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复子组并重新计算控制限
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="作废原因 (如: 调机首件/异常排除)"
                    value={voidReasonInput}
                    onChange={(e) => setVoidReasonInput(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 w-52"
                  />
                  <button
                    onClick={() => {
                      onVoidSubgroup(selectedPoint.id, voidReasonInput || '异常值作废排除');
                      setVoidReasonInput('');
                      setSelectedPoint(null);
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    作废此子组并重新计算控制限
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>访客只读模式：仅可查看点位信息，不可作废数据</span>
              </div>
            )}
            <button
              onClick={() => setSelectedPoint(null)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
