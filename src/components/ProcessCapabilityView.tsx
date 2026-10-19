/**
 * 过程能力分析 (Process Capability Analysis) 组件
 * 提供 Cp, Cpk, Pp, Ppk, CPU, CPL, Ca 指数计算
 * 绘制实测测量值直方图与高斯正态分布钟形拟合曲线
 */

import React, { useMemo } from 'react';
import { 
  ProcessCharacteristic, 
  SubgroupDataPoint, 
  ProcessCapability 
} from '../types/spc';
import { normalPdf } from '../utils/spcEngine';
import { 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  BarChart3, 
  Info,
  ShieldCheck
} from 'lucide-react';

interface ProcessCapabilityViewProps {
  process: ProcessCharacteristic;
  subgroups: SubgroupDataPoint[];
  capability: ProcessCapability;
}

export const ProcessCapabilityView: React.FC<ProcessCapabilityViewProps> = ({
  process,
  subgroups,
  capability,
}) => {
  // 提取全部有效单值样本
  const sampleValues = useMemo(() => {
    const vals: number[] = [];
    subgroups.filter(s => !s.isVoided).forEach(s => {
      if (s.values && s.values.length > 0) {
        vals.push(...s.values);
      } else {
        vals.push(s.mean);
      }
    });
    return vals;
  }, [subgroups]);

  // 直方图分组统计 (Binned data)
  const histogramData = useMemo(() => {
    if (sampleValues.length === 0) return { bins: [], min: 0, max: 1, step: 0.1, maxCount: 1 };
    
    const minVal = Math.min(...sampleValues);
    const maxVal = Math.max(...sampleValues);
    const range = maxVal - minVal || 0.001;
    
    // 经验公式选择直方图组数 k ≈ sqrt(N)
    const binCount = Math.max(7, Math.min(18, Math.round(Math.sqrt(sampleValues.length))));
    const step = range / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      x0: minVal + i * step,
      x1: minVal + (i + 1) * step,
      mid: minVal + (i + 0.5) * step,
      count: 0
    }));

    sampleValues.forEach(v => {
      let idx = Math.floor((v - minVal) / step);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx].count++;
    });

    const maxCount = Math.max(...bins.map(b => b.count), 1);

    return { bins, min: minVal, max: maxVal, step, maxCount };
  }, [sampleValues]);

  // SVG 尺寸
  const svgWidth = 800;
  const svgHeight = 280;
  const padding = { top: 20, right: 60, bottom: 40, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // X 轴与正态曲线坐标转换
  const xDomainMin = Math.min(histogramData.min, process.lsl ?? histogramData.min);
  const xDomainMax = Math.max(histogramData.max, process.usl ?? histogramData.max);
  const xSpan = (xDomainMax - xDomainMin) || 1;
  const marginX = xSpan * 0.1;
  const minX = xDomainMin - marginX;
  const maxX = xDomainMax + marginX;

  const getX = (val: number) => {
    return padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
  };

  const getYCount = (count: number) => {
    return padding.top + plotHeight - (count / histogramData.maxCount) * plotHeight;
  };

  // 生成正态分布拟合曲线采样点
  const normalCurvePath = useMemo(() => {
    if (capability.sigmaWithin <= 0 || sampleValues.length === 0) return '';
    const points: string[] = [];
    const steps = 100;
    
    // 最大密度对应直方图最大高度的比例因子
    const maxDensity = normalPdf(capability.mean, capability.mean, capability.sigmaWithin);
    
    for (let i = 0; i <= steps; i++) {
      const curX = minX + (i / steps) * (maxX - minX);
      const density = normalPdf(curX, capability.mean, capability.sigmaWithin);
      const scaledY = maxDensity > 0 ? (density / maxDensity) * (plotHeight * 0.95) : 0;
      const xPixel = getX(curX);
      const yPixel = padding.top + plotHeight - scaledY;
      points.push(`${i === 0 ? 'M' : 'L'} ${xPixel.toFixed(1)} ${yPixel.toFixed(1)}`);
    }

    return points.join(' ');
  }, [minX, maxX, capability, plotHeight, histogramData]);

  return (
    <div className="space-y-4">
      {/* 过程能力核心指标看板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CPK 指数卡片 */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">制程能力指数 (Cpk)</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              capability.grade === 'A+' || capability.grade === 'A' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : capability.grade === 'B' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              等级: {capability.grade}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100 font-mono">
              {capability.cpk !== undefined ? capability.cpk : '--'}
            </span>
            <span className="text-xs text-slate-400">
              Cp: {capability.cp !== undefined ? capability.cp : '--'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {capability.gradeDesc}
          </p>
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${
            capability.grade === 'A+' || capability.grade === 'A' ? 'bg-emerald-500' : capability.grade === 'B' ? 'bg-amber-500' : 'bg-rose-500'
          }`} />
        </div>

        {/* PPK 长期性能指数卡片 */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">过程性能指数 (Ppk)</span>
            <span className="text-[11px] text-indigo-400 font-mono">整体波动</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100 font-mono">
              {capability.ppk !== undefined ? capability.ppk : '--'}
            </span>
            <span className="text-xs text-slate-400">
              Pp: {capability.pp !== undefined ? capability.pp : '--'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            整体标准差 s: {capability.sigmaOverall}
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        {/* 过程波动估算 */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">组内波动 (Sigma Within)</span>
            <span className="text-[11px] text-sky-400 font-mono">Rbar/d2</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-300 font-mono">
              {capability.sigmaWithin}
            </span>
            <span className="text-xs text-slate-400">{process.unit}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>总均值 X̄̄: <b className="text-slate-200">{capability.mean}</b></span>
            <span>准确度 Ca: <b className="text-slate-200">{capability.ca ?? '--'}</b></span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500" />
        </div>

        {/* 预估不良率 PPM */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">预期缺陷水平 (PPM)</span>
            <span className="text-[11px] text-emerald-400 font-mono">六西格玛标杆</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              {capability.ppm !== undefined ? (capability.ppm < 1 ? '< 1' : capability.ppm) : '--'}
            </span>
            <span className="text-xs text-slate-400">PPM</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {capability.cpk && capability.cpk >= 1.33 ? '制程处于受控经济运行区' : '建议排查系统误差源与变异'}
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>
      </div>

      {/* 直方图与正态拟合钟形曲线 */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              实测数据分布直方图与高斯正态拟合钟形曲线 (N={sampleValues.length})
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-sky-600/70 border border-sky-400 rounded-sm"></span>
              直方频数柱
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-amber-400"></span>
              正态分布拟合线
            </span>
            {process.usl !== undefined && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-purple-500 border-dashed"></span>
                规格上下限 (USL/LSL)
              </span>
            )}
          </div>
        </div>

        {/* SVG 直方图 */}
        <div className="relative bg-slate-950 border border-slate-800/80 rounded-lg p-2 overflow-hidden">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto select-none font-sans">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* 绘图区边框 */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* 直方图柱子 */}
            {histogramData.bins.map((bin, idx) => {
              const xStart = getX(bin.x0);
              const xEnd = getX(bin.x1);
              const width = Math.max(1, xEnd - xStart - 2);
              const y = getYCount(bin.count);
              const height = padding.top + plotHeight - y;

              return (
                <g key={idx}>
                  <rect
                    x={xStart + 1}
                    y={y}
                    width={width}
                    height={height}
                    fill="url(#barGradient)"
                    stroke="#0284c7"
                    strokeWidth="1"
                    rx="1"
                  />
                  {bin.count > 0 && (
                    <text
                      x={xStart + width / 2}
                      y={y - 4}
                      fill="#94a3b8"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {bin.count}
                    </text>
                  )}
                  {/* X 轴刻度标尺 */}
                  <text
                    x={xStart + width / 2}
                    y={padding.top + plotHeight + 15}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {bin.mid.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* 均值中心线 Xbar */}
            <line
              x1={getX(capability.mean)}
              y1={padding.top}
              x2={getX(capability.mean)}
              y2={padding.top + plotHeight}
              stroke="#10b981"
              strokeWidth="1.8"
            />
            <text
              x={getX(capability.mean)}
              y={padding.top - 5}
              fill="#34d399"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              Mean: {capability.mean}
            </text>

            {/* 规格限 USL / LSL */}
            {process.usl !== undefined && (
              <>
                <line
                  x1={getX(process.usl)}
                  y1={padding.top}
                  x2={getX(process.usl)}
                  y2={padding.top + plotHeight}
                  stroke="#c084fc"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <text
                  x={getX(process.usl)}
                  y={padding.top + 14}
                  fill="#c084fc"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  USL: {process.usl}
                </text>
              </>
            )}

            {process.lsl !== undefined && (
              <>
                <line
                  x1={getX(process.lsl)}
                  y1={padding.top}
                  x2={getX(process.lsl)}
                  y2={padding.top + plotHeight}
                  stroke="#c084fc"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <text
                  x={getX(process.lsl)}
                  y={padding.top + 14}
                  fill="#c084fc"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  LSL: {process.lsl}
                </text>
              </>
            )}

            {/* 正态钟形曲线 */}
            {normalCurvePath && (
              <path
                d={normalCurvePath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>

        {/* 评价建议表 */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block">SPC 过程能力等级判定准则:</span>
            <div className="text-slate-400 space-y-0.5 text-[11px]">
              <div>• <b>A+ 级 (Cpk ≥ 1.67):</b> 过程能力极充裕，品质卓越，允许放宽检验或减少巡检频次</div>
              <div>• <b>A 级 (1.33 ≤ Cpk &lt; 1.67):</b> 过程能力充裕，处于经济受控理想状态</div>
              <div>• <b>B 级 (1.00 ≤ Cpk &lt; 1.33):</b> 处于临界合格边缘，需密切监控趋势变化</div>
              <div>• <b>C/D 级 (Cpk &lt; 1.00):</b> 过程能力不足，制程极易产生超差报废，须紧急停机排查</div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-slate-200 block">当前工序诊断建议:</span>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              {capability.cpk && capability.cpk >= 1.33 ? (
                <span className="text-emerald-300">
                  当前工序均值中心度与分布散布控制优良。建议继续保持标准化作业 (SOP)，定期巡检刀具磨损与夹具精度。
                </span>
              ) : (
                <span className="text-amber-300">
                  检测到过程均值发生偏离或波动较大。建议结合控制图上的 Nelson 规则报警点，针对性核查设备主轴跳动、原料批次波动或操作员换班因素。
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
