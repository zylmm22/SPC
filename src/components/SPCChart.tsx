import React, { useState, useMemo } from 'react';
import { 
  SubgroupDataPoint, 
  ControlLimits, 
  ProcessCharacteristic, 
  AuditLevelMode,
  CNAuditConfig,
  GJBAuditConfig
} from '../types/spc';
import { NELSON_8_RULES } from '../utils/spcConstants';
import { 
  AlertTriangle, 
  CheckCircle2, 
  EyeOff, 
  Sliders, 
  RotateCcw,
  Sparkles,
  Activity,
  Award,
  ShieldCheck,
  Settings,
  Lock,
  Calendar
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
  
  // X 轴显示模式: 批次顺序(1,2,3) | 生产批次号 | 采集日期时间
  const [xAxisMode, setXAxisMode] = useState<'seq' | 'batchNo' | 'sampleTime'>('seq');

  const isDualChart = ['xbar-r', 'xbar-s', 'i-mr'].includes(process.chartType);

  // 1. 规格限智能校验与防呆处理 (彻底修复 LSL: 0.7 倒挂在 UCL 上方的 Bug)
  const normalizedSpecs = useMemo(() => {
    let rawUsl = process.usl;
    let rawLsl = process.lsl;

    if (rawUsl === undefined && rawLsl === undefined) {
      return { usl: undefined, lsl: undefined, isCorrected: false };
    }

    let isCorrected = false;

    // 容错 1: USL 与 LSL 大小写反了
    if (rawUsl !== undefined && rawLsl !== undefined && rawLsl > rawUsl) {
      const temp = rawUsl;
      rawUsl = rawLsl;
      rawLsl = temp;
      isCorrected = true;
    }

    // 容错 2: 中心线在 0 附近 (偏差特征)，但 LSL 填成了正数 (例如公差 ±0.7 漏填负号录成 +0.7)
    // 判断条件：LSL > CL 且 数据点大部分处于 LSL 之下
    if (rawLsl !== undefined && rawLsl > limits.cl) {
      const pointsBelowLsl = subgroups.filter(s => s.mean < rawLsl!).length;
      if (pointsBelowLsl / (subgroups.length || 1) > 0.7) {
        // 判定为缺失负号，自动纠偏为负数
        rawLsl = -Math.abs(rawLsl);
        isCorrected = true;
      }
    }

    return { usl: rawUsl, lsl: rawLsl, isCorrected };
  }, [process.usl, process.lsl, limits.cl, subgroups]);

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

  // SVG 画布尺寸配置 (右边距增大到 105，防止文字超出)
  const svgWidth = 980;
  const mainHeight = isDualChart ? 285 : 365;
  const subHeight = isDualChart ? 190 : 0;
  const padding = { top: 25, right: 105, bottom: 38, left: 65 };

  // 绘图区域有效尺寸
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotMainHeight = mainHeight - padding.top - padding.bottom;
  const plotSubHeight = subHeight - padding.top - padding.bottom;

  // 提取副图对应统计量
  const getSubPointVal = (sg: SubgroupDataPoint): number => {
    if (process.chartType === 'xbar-s') {
      return sg.stdDev !== undefined ? sg.stdDev : (sg.range ?? 0);
    }
    if (process.chartType === 'i-mr') {
      return sg.movingRange !== undefined ? sg.movingRange : (sg.range ?? 0);
    }
    return sg.range !== undefined ? sg.range : (sg.stdDev ?? sg.movingRange ?? 0);
  };

  // X 轴标签格式化
  const formatXAxisLabel = (sg: SubgroupDataPoint, mode: 'seq' | 'batchNo' | 'sampleTime') => {
    if (mode === 'seq') return `${sg.seq}`;
    if (mode === 'batchNo') {
      if (!sg.batchNo) return `#${sg.seq}`;
      if (sg.batchNo.startsWith('LOT-')) {
        const parts = sg.batchNo.split('-');
        if (parts.length >= 3) return `LOT-${parts[parts.length - 1]}`;
      }
      return sg.batchNo.length > 10 ? sg.batchNo.slice(-7) : sg.batchNo;
    }
    if (mode === 'sampleTime') {
      if (!sg.sampleTime) return `#${sg.seq}`;
      const parts = sg.sampleTime.trim().split(' ');
      if (parts.length >= 2) {
        const d = parts[0].length >= 10 ? parts[0].slice(5) : parts[0];
        const t = parts[1].slice(0, 5);
        return `${d} ${t}`;
      }
      return sg.sampleTime.length >= 10 ? sg.sampleTime.slice(5) : sg.sampleTime;
    }
    return `${sg.seq}`;
  };

  const tickInterval = useMemo(() => {
    if (subgroups.length <= 10) return 1;
    if (xAxisMode === 'sampleTime') return Math.max(1, Math.ceil(subgroups.length / 8));
    if (xAxisMode === 'batchNo') return Math.max(1, Math.ceil(subgroups.length / 10));
    return Math.max(1, Math.ceil(subgroups.length / 16));
  }, [subgroups.length, xAxisMode]);

  // 主图 Y 轴范围计算 (包含校正后的规格限)
  const mainYRange = useMemo(() => {
    const mainValues = subgroups.map(s => s.mean);
    const ucl = limits.ucl;
    const lcl = limits.lcl;
    const cl = limits.cl;
    const usl = showSpecLimits && normalizedSpecs.usl !== undefined ? normalizedSpecs.usl : ucl;
    const lsl = showSpecLimits && normalizedSpecs.lsl !== undefined ? normalizedSpecs.lsl : lcl;

    const variableY = (limits.hasVariableLimits && limits.variableLimits)
      ? limits.variableLimits.flatMap(v => [v.ucl, v.lcl, v.cl])
      : [];

    const allY = [...mainValues, ucl, lcl, cl, usl, lsl, ...variableY].filter(v => v !== undefined && !isNaN(v));
    const minVal = Math.min(...allY);
    const maxVal = Math.max(...allY);
    const span = maxVal - minVal || 1;
    const margin = span * 0.15;

    return {
      min: minVal - margin,
      max: maxVal + margin
    };
  }, [subgroups, limits, normalizedSpecs, showSpecLimits]);

  // 副图 Y 轴范围计算
  const subYRange = useMemo(() => {
    if (!isDualChart) return { min: 0, max: 1 };
    const subValues = subgroups.map(s => getSubPointVal(s));
    const subUcl = limits.subUcl ?? 1;
    const subLcl = limits.subLcl ?? 0;
    const subCl = limits.subCl ?? 0.5;

    const allY = [...subValues, subUcl, subLcl, subCl].filter(v => v !== undefined && !isNaN(v));
    const minVal = Math.min(...allY);
    const maxVal = Math.max(...allY);
    const span = maxVal - minVal || 1;
    const margin = span * 0.15;

    return {
      min: minVal - margin,
      max: maxVal + margin
    };
  }, [subgroups, limits, isDualChart, process.chartType]);

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

  // 小数格式化
  const mainDecimals = useMemo(() => {
    if (limits.ucl !== undefined && String(limits.ucl).includes('.')) return String(limits.ucl).split('.')[1].length;
    if (limits.cl !== undefined && String(limits.cl).includes('.')) return String(limits.cl).split('.')[1].length;
    return 4;
  }, [limits.ucl, limits.cl]);

  const subDecimals = useMemo(() => {
    if (limits.subUcl !== undefined && String(limits.subUcl).includes('.')) return String(limits.subUcl).split('.')[1].length;
    return 4;
  }, [limits.subUcl]);

  const formatLimitValue = (val: number | undefined, decimals: number) => {
    if (val === undefined || isNaN(val)) return '-';
    return Number(val.toFixed(decimals)).toString();
  };

  // 2. 右侧文本标签防重叠避让算法 (Anti-Collision Engine)
  const adjustLabelPositions = (labels: Array<{ id: string; rawY: number; text: string; color: string; fontSize: number; isBold?: boolean }>) => {
    if (labels.length === 0) return [];
    // 按原始 Y 从小到大排序 (即从上到下)
    const sorted = [...labels].sort((a, b) => a.rawY - b.rawY);
    const minSpacing = 14; // 两行文字之间的最小安全垂直像素间距

    // 第一次自上而下推挤
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].rawY - sorted[i - 1].rawY < minSpacing) {
        sorted[i].rawY = sorted[i - 1].rawY + minSpacing;
      }
    }

    return sorted;
  };

  // 构造主图右侧基准线与标签数据
  const mainChartLabels = useMemo(() => {
    const list: Array<{ id: string; rawY: number; text: string; color: string; fontSize: number; isBold?: boolean; val: number }> = [];

    if (showSpecLimits && normalizedSpecs.usl !== undefined) {
      list.push({
        id: 'usl',
        val: normalizedSpecs.usl,
        rawY: getMainY(normalizedSpecs.usl),
        text: `USL: ${normalizedSpecs.usl}`,
        color: '#c084fc',
        fontSize: 10,
        isBold: true
      });
    }

    if (limits.ucl !== undefined && !isNaN(limits.ucl)) {
      list.push({
        id: 'ucl',
        val: limits.ucl,
        rawY: getMainY(limits.ucl),
        text: `UCL: ${formatLimitValue(limits.ucl, mainDecimals)}`,
        color: '#ef4444',
        fontSize: 11,
        isBold: true
      });
    }

    if (limits.cl !== undefined && !isNaN(limits.cl)) {
      list.push({
        id: 'cl',
        val: limits.cl,
        rawY: getMainY(limits.cl),
        text: `CL: ${formatLimitValue(limits.cl, mainDecimals)}`,
        color: '#34d399',
        fontSize: 11,
        isBold: true
      });
    }

    if (limits.lcl !== undefined && !isNaN(limits.lcl)) {
      list.push({
        id: 'lcl',
        val: limits.lcl,
        rawY: getMainY(limits.lcl),
        text: `LCL: ${formatLimitValue(limits.lcl, mainDecimals)}`,
        color: '#ef4444',
        fontSize: 11,
        isBold: true
      });
    }

    if (showSpecLimits && normalizedSpecs.lsl !== undefined) {
      list.push({
        id: 'lsl',
        val: normalizedSpecs.lsl,
        rawY: getMainY(normalizedSpecs.lsl),
        text: `LSL: ${normalizedSpecs.lsl}`,
        color: '#c084fc',
        fontSize: 10,
        isBold: true
      });
    }

    const adjusted = adjustLabelPositions(list);
    const map: Record<string, number> = {};
    adjusted.forEach(item => { map[item.id] = item.rawY; });
    return { list, adjustedMap: map };
  }, [limits, normalizedSpecs, showSpecLimits, mainYRange, mainDecimals]);

  // 主副图标题与单位
  const chartLabels = useMemo(() => {
    switch (process.chartType) {
      case 'xbar-r':
        return { main: '均值 (X-bar) 控制图', sub: '极差 (R) 控制图' };
      case 'xbar-s':
        return { main: '均值 (X-bar) 控制图', sub: '标准差 (S) 控制图' };
      case 'i-mr':
        return { main: '单值 (I) 控制图', sub: '移动极差 (MR) 控制图' };
      case 'p':
        return { main: '不良率 (P) 控制图', sub: '' };
      case 'np':
        return { main: '不合格品数 (NP) 控制图', sub: '' };
      case 'c':
        return { main: '缺陷总数 (C) 控制图', sub: '' };
      case 'u':
        return { main: '单位缺陷数 (U) 控制图', sub: '' };
      default:
        return { main: '主控制图', sub: '辅助控制图' };
    }
  }, [process.chartType]);

  const sigmaMain = (limits.ucl - limits.cl) / 3;

  return (
    <div className="space-y-4">
      {/* 审查审计专项工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-900/50 rounded-xl shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            审查模拟功能 (用于体系审查与抽检):
          </span>
          <div className="flex items-center gap-2">
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

            <button
              onClick={() => {
                if (!cnConfig?.isConfigured) onOpenAuditModal && onOpenAuditModal('cn');
                else onSwitchAuditMode && onSwitchAuditMode('cn');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                auditMode === 'cn'
                  ? 'bg-sky-600 text-white border border-sky-400 shadow-sky-600/30'
                  : 'bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/80'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              CN等级
            </button>

            <button
              onClick={() => {
                if (!gjbConfig?.isConfigured) onOpenAuditModal && onOpenAuditModal('gjb');
                else onSwitchAuditMode && onSwitchAuditMode('gjb');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                auditMode === 'gjb'
                  ? 'bg-amber-600 text-white border border-amber-400 shadow-amber-600/30'
                  : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              国军标等级
            </button>
          </div>
        </div>

        {auditMode !== 'real' && (
          <button
            onClick={() => onOpenAuditModal && onOpenAuditModal(auditMode)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-indigo-900/80"
          >
            <Settings className="w-3.5 h-3.5" />
            修改{auditMode === 'cn' ? 'CN等级' : '国军标'}参数
          </button>
        )}
      </div>

      {/* 规格限纠错友好提醒横幅 */}
      {normalizedSpecs.isCorrected && (
        <div className="p-2.5 px-3 bg-amber-950/40 border border-amber-700/60 rounded-xl text-xs text-amber-300 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <b>智能规格限纠偏生效</b>：原始下规格限设定为 <code>{process.lsl}</code>（处于中心线之上），系统已自适应修正为真实对称下限 <code>{normalizedSpecs.lsl}</code>，已杜绝图表翻转重叠。
            </span>
          </div>
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
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-indigo-900/60 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              X轴显示:
            </span>
            <select
              value={xAxisMode}
              onChange={(e) => setXAxisMode(e.target.value as any)}
              className="bg-slate-900 text-indigo-200 font-medium text-xs rounded border border-indigo-950/80 px-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="seq">批次顺序 (1, 2, 3...)</option>
              <option value="batchNo">生产批次号 (如 LOT-047)</option>
              <option value="sampleTime">采集日期时间</option>
            </select>
          </div>

          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              showZones ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {showZones ? '显示 1σ/2σ/3σ 区域' : '隐藏 1σ/2σ 区域'}
          </button>
          
          {(normalizedSpecs.usl !== undefined || normalizedSpecs.lsl !== undefined) && (
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

      {/* Nelson 8 大判异准则 */}
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
            <button onClick={() => onToggleAllRules(true)} className="text-[11px] text-indigo-400 hover:text-indigo-300 underline">全选</button>
            <span className="text-slate-600">|</span>
            <button onClick={() => onToggleAllRules(false)} className="text-[11px] text-slate-400 hover:text-slate-300 underline">全清</button>
          </div>
        </div>

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
                    ? hits > 0 ? 'bg-rose-950/40 border-rose-600/60 text-rose-200' : 'bg-indigo-950/40 border-indigo-700/60 text-slate-200'
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
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
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
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl + 3 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl + 2 * sigmaMain) - getMainY(limits.cl + 3 * sigmaMain))}
                  fill="url(#zoneAGradient)"
                />
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl - 2 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl - 3 * sigmaMain) - getMainY(limits.cl - 2 * sigmaMain))}
                  fill="url(#zoneAGradient)"
                />
                <rect
                  x={padding.left}
                  y={getMainY(limits.cl + 1 * sigmaMain)}
                  width={plotWidth}
                  height={Math.max(0, getMainY(limits.cl - 1 * sigmaMain) - getMainY(limits.cl + 1 * sigmaMain))}
                  fill="url(#zoneCGradient)"
                />
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

            {/* 规格界限 (USL / LSL) 绘制 */}
            {showSpecLimits && normalizedSpecs.usl !== undefined && (
              <line
                x1={padding.left}
                y1={getMainY(normalizedSpecs.usl)}
                x2={padding.left + plotWidth}
                y2={getMainY(normalizedSpecs.usl)}
                stroke="#c084fc"
                strokeWidth="1.2"
                strokeDasharray="4,3"
              />
            )}
            {showSpecLimits && normalizedSpecs.lsl !== undefined && (
              <line
                x1={padding.left}
                y1={getMainY(normalizedSpecs.lsl)}
                x2={padding.left + plotWidth}
                y2={getMainY(normalizedSpecs.lsl)}
                stroke="#c084fc"
                strokeWidth="1.2"
                strokeDasharray="4,3"
              />
            )}

            {/* 控制限基准线: UCL, CL, LCL */}
            {limits.ucl !== undefined && !isNaN(limits.ucl) && (
              <line
                x1={padding.left}
                y1={getMainY(limits.ucl)}
                x2={padding.left + plotWidth}
                y2={getMainY(limits.ucl)}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5,4"
              />
            )}

            {limits.cl !== undefined && !isNaN(limits.cl) && (
              <line
                x1={padding.left}
                y1={getMainY(limits.cl)}
                x2={padding.left + plotWidth}
                y2={getMainY(limits.cl)}
                stroke="#10b981"
                strokeWidth="1.8"
              />
            )}

            {limits.lcl !== undefined && !isNaN(limits.lcl) && (
              <line
                x1={padding.left}
                y1={getMainY(limits.lcl)}
                x2={padding.left + plotWidth}
                y2={getMainY(limits.lcl)}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5,4"
              />
            )}

            {/* 右侧避让防遮挡文字标签渲染 */}
            {mainChartLabels.list.map(lbl => {
              const adjustedY = mainChartLabels.adjustedMap[lbl.id] ?? lbl.rawY;
              const hasShifted = Math.abs(adjustedY - lbl.rawY) > 2;

              return (
                <g key={lbl.id}>
                  {/* 若发生避让位移，绘制微小引导折线指回基准线 */}
                  {hasShifted && (
                    <path
                      d={`M ${padding.left + plotWidth + 1} ${lbl.rawY} L ${padding.left + plotWidth + 5} ${adjustedY}`}
                      fill="none"
                      stroke={lbl.color}
                      strokeWidth="0.8"
                      strokeOpacity="0.6"
                    />
                  )}
                  <text
                    x={padding.left + plotWidth + 7}
                    y={adjustedY + 3.5}
                    fill={lbl.color}
                    fontSize={lbl.fontSize}
                    fontWeight={lbl.isBold ? 'bold' : 'normal'}
                  >
                    {lbl.text}
                  </text>
                </g>
              );
            })}

            {/* 主图折线 */}
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

            {/* 主图数据点 */}
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

                  {isVoided ? (
                    <g opacity="0.6">
                      <circle cx={x} cy={y} r="5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />
                      <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke="#f43f5e" strokeWidth="1.5" />
                    </g>
                  ) : hasViolations ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6.5 : 5.5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6 : 4.5}
                      fill={isSelected ? '#38bdf8' : '#0ea5e9'}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* X 轴刻度 */}
                  {(idx % tickInterval === 0 || idx === subgroups.length - 1) && (
                    <text
                      x={x}
                      y={padding.top + plotMainHeight + 18}
                      fill="#94a3b8"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {formatXAxisLabel(sg, xAxisMode)}
                    </text>
                  )}
                </g>
              );
            })}

            <text
              x={padding.left + plotWidth}
              y={padding.top + plotMainHeight + 32}
              fill="#64748b"
              fontSize="9"
              textAnchor="end"
            >
              [X轴: {xAxisMode === 'seq' ? '批次顺序 1,2,3...' : xAxisMode === 'batchNo' ? '生产批次号' : '采集日期时间'}]
            </text>

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

          {/* ======================= 副图绘制 (S / R / MR) ======================= */}
          {isDualChart && (
            <g id="sub-chart" transform={`translate(0, ${mainHeight + 15})`}>
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

              {/* 副图 UCL / CL / LCL */}
              {limits.subUcl !== undefined && !isNaN(limits.subUcl) && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subUcl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subUcl)}
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="5,4"
                  />
                  <text
                    x={padding.left + plotWidth + 7}
                    y={getSubY(limits.subUcl) + 4}
                    fill="#ef4444"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    UCL: {formatLimitValue(limits.subUcl, subDecimals)}
                  </text>
                </>
              )}

              {limits.subCl !== undefined && !isNaN(limits.subCl) && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subCl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subCl)}
                    stroke="#10b981"
                    strokeWidth="1.8"
                  />
                  <text
                    x={padding.left + plotWidth + 7}
                    y={getSubY(limits.subCl) + 4}
                    fill="#34d399"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    CL: {formatLimitValue(limits.subCl, subDecimals)}
                  </text>
                </>
              )}

              {limits.subLcl !== undefined && !isNaN(limits.subLcl) && (
                <>
                  <line
                    x1={padding.left}
                    y1={getSubY(limits.subLcl)}
                    x2={padding.left + plotWidth}
                    y2={getSubY(limits.subLcl)}
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="5,4"
                  />
                  <text
                    x={padding.left + plotWidth + 7}
                    y={getSubY(limits.subLcl) + 4}
                    fill="#ef4444"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    LCL: {formatLimitValue(limits.subLcl, subDecimals)}
                  </text>
                </>
              )}

              {/* 副图折线 */}
              <path
                d={subgroups.map((sg, idx) => {
                  const val = getSubPointVal(sg);
                  const x = getX(idx);
                  const y = getSubY(val);
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 副图数据点与刻度 */}
              {subgroups.map((sg, idx) => {
                const val = getSubPointVal(sg);
                const x = getX(idx);
                const y = getSubY(val);
                const isVoided = sg.isVoided;
                const isSelected = selectedPoint?.id === sg.id;
                const hasSubViolations = sg.violations && sg.violations.some(v => v.chartPart === 'sub');

                return (
                  <g 
                    key={`sub-${sg.id}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedPoint(sg)}
                  >
                    {isVoided ? (
                      <circle cx={x} cy={y} r="4" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />
                    ) : hasSubViolations ? (
                      <circle cx={x} cy={y} r={isSelected ? 6 : 5} fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    ) : (
                      <circle cx={x} cy={y} r={isSelected ? 5.5 : 4} fill={isSelected ? '#c4b5fd' : '#8b5cf6'} stroke="#0f172a" strokeWidth="1.5" />
                    )}

                    {(idx % tickInterval === 0 || idx === subgroups.length - 1) && (
                      <text
                        x={x}
                        y={padding.top + plotSubHeight + 18}
                        fill="#94a3b8"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {formatXAxisLabel(sg, xAxisMode)}
                      </text>
                    )}
                  </g>
                );
              })}

              <text
                x={padding.left + plotWidth}
                y={padding.top + plotSubHeight + 32}
                fill="#64748b"
                fontSize="9"
                textAnchor="end"
              >
                [X轴: {xAxisMode === 'seq' ? '批次顺序 1,2,3...' : xAxisMode === 'batchNo' ? '生产批次号' : '采集日期时间'}]
              </text>

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
            </div>

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
          </div>
        )}
      </div>

      {/* 点击选定子组操作抽屉 */}
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
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span>子组均值: <b className="text-sky-400 font-mono">{selectedPoint.mean} {process.unit}</b></span>
              {selectedPoint.range !== undefined && <span>极差 R: <b className="text-purple-400 font-mono">{selectedPoint.range}</b></span>}
              {selectedPoint.stdDev !== undefined && <span>标准差 S: <b className="text-purple-400 font-mono">{selectedPoint.stdDev}</b></span>}
              <span>状态: {selectedPoint.isVoided ? <b className="text-amber-400">已作废</b> : <b className="text-emerald-400">有效样本</b>}</span>
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
                  恢复子组并重新计算
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="作废原因 (如: 调机首件排除)"
                    value={voidReasonInput}
                    onChange={(e) => setVoidReasonInput(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 w-48"
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
                    作废并重新计算
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>访客只读模式</span>
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