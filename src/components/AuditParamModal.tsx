


import React, { useState, useEffect } from 'react';
import { 
  ProcessCharacteristic, 
  ControlLimits, 
  CNAuditConfig, 
  GJBAuditConfig 
} from '../types/spc';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  Award, 
  ShieldCheck, 
  Layers,
  Settings2,
  SlidersHorizontal,
  Info
} from 'lucide-react';

interface AuditParamModalProps {
  isOpen: boolean;
  type: 'cn' | 'gjb';
  process: ProcessCharacteristic;
  allProcesses?: ProcessCharacteristic[];
  currentLimits: ControlLimits;
  initialCnConfig: CNAuditConfig;
  initialGjbConfig: GJBAuditConfig;
  onClose: () => void;
  onSaveCnConfig: (cfg: CNAuditConfig) => void;
  onSaveGjbConfig: (cfg: GJBAuditConfig) => void;
  onSelectProcess?: (processId: string) => void;
}

export const AuditParamModal: React.FC<AuditParamModalProps> = ({
  isOpen,
  type,
  process,
  allProcesses = [],
  currentLimits,
  initialCnConfig,
  initialGjbConfig,
  onClose,
  onSaveCnConfig,
  onSaveGjbConfig,
  onSelectProcess,
}) => {
  // 选中的目标工序
  const [selectedProcId, setSelectedProcId] = useState<string>(process.id);
  
  // 核心输入项：要求的 CPK 值
  const [targetCpk, setTargetCpk] = useState<number>(type === 'gjb' ? 1.67 : 1.33);
  
  // 生成参数项：批次数与子组大小
  const [batchCount, setBatchCount] = useState<number>(50);
  const [sampleSize, setSampleSize] = useState<number>(process.sampleSize || 5);

  // 展开高级微调 (规范限/控制限微调)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customUsl, setCustomUsl] = useState<string>('');
  const [customLsl, setCustomLsl] = useState<string>('');

  // 当前工序对象
  const activeProc = (allProcesses.length > 0 ? allProcesses.find(p => p.id === selectedProcId) : null) || process;

  // 抓取并自动规范化工序的 USL / LSL（智能防呆：保证 LSL < USL）
  const autoSpecs = React.useMemo(() => {
    // 1. 抓取工序真实配置值
    const u = activeProc.usl !== undefined ? activeProc.usl : 1.0;
    const l = activeProc.lsl !== undefined ? activeProc.lsl : 0.0;

    // 2. 中心值优先取配置的目标值 SL，若未填写则自动取中点 (USL + LSL) / 2
    let s: number;
    if (activeProc.sl !== undefined && !isNaN(activeProc.sl)) {
      s = activeProc.sl;
    } else {
      s = Number(((u + l) / 2).toFixed(4));
    }

    return { usl: u, lsl: l, sl: s };
  }, [activeProc]);

  // 切换工序时自动抓取
  useEffect(() => {
    if (isOpen) {
      setSelectedProcId(process.id);
      setTargetCpk(type === 'gjb' ? (initialGjbConfig.targetCpk || 1.67) : (initialCnConfig.targetCpk || 1.33));
      setBatchCount(type === 'gjb' ? (initialGjbConfig.batchCount || 50) : (initialCnConfig.batchCount || 50));
      setSampleSize(activeProc.sampleSize || 5);
      setCustomUsl(String(autoSpecs.usl));
      setCustomLsl(String(autoSpecs.lsl));
    }
  }, [isOpen, process, type, initialCnConfig, initialGjbConfig]);

  if (!isOpen) return null;

  const handleProcessChange = (procId: string) => {
    setSelectedProcId(procId);
    if (onSelectProcess) onSelectProcess(procId);
    const p = allProcesses.find(item => item.id === procId);
    if (p) {
      setSampleSize(p.sampleSize || 5);
      const u = p.usl ?? 1.0;
      const l = p.lsl ?? 0.0;
      setCustomUsl(String(u));
      setCustomLsl(String(l));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUsl = showAdvanced && customUsl ? parseFloat(customUsl) : autoSpecs.usl;
    const finalLsl = showAdvanced && customLsl ? parseFloat(customLsl) : autoSpecs.lsl;
    const finalSl = Number(((finalUsl + finalLsl) / 2).toFixed(4));

    if (type === 'cn') {
      onSaveCnConfig({
        targetCpk,
        batchCount,
        sampleSize,
        processId: selectedProcId,
        usl: finalUsl,
        sl: finalSl,
        lsl: finalLsl,
        isConfigured: true
      });
    } else {
      onSaveGjbConfig({
        targetCpk,
        batchCount,
        sampleSize,
        processId: selectedProcId,
        usl: finalUsl,
        sl: finalSl,
        lsl: finalLsl,
        isConfigured: true
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              type === 'cn' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {type === 'cn' ? <Award className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  {type === 'cn' ? 'CN 等级审查模拟配置' : '国军标等级审查模拟配置'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  一键极简生成
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                自动抓取工序规范限与样本量，只需输入目标 CPK 即可精准数学反推
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单主体 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 1. 目标工序选择 (自动抓取规范限) */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                目标工序 (自动抓取图表类型与规范限):
              </span>
              <span className="text-[11px] font-mono text-indigo-400">
                {activeProc.chartType.toUpperCase()}
              </span>
            </label>
            <select
              value={selectedProcId}
              onChange={(e) => handleProcessChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              {(allProcesses.length > 0 ? allProcesses : [process]).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.processName || '主工序'}) - [{p.chartType.toUpperCase()}]
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
              <span>已抓取规范限: <b className="text-purple-300">[{autoSpecs.lsl}, {autoSpecs.usl}] {activeProc.unit}</b></span>
              <span>中心值 SL: <b className="text-emerald-400">{autoSpecs.sl}</b></span>
            </div>
          </div>

          {/* 2. 核心输入：要求的 CPK 数据值 */}
          <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/30 border border-indigo-900/60 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                要求的 CPK 值 (只需输入此项):
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {type === 'gjb' ? '军标通常要求 ≥ 1.67' : '推荐: 1.33(合格) / 1.50 / 1.67'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="3.0"
                required
                value={targetCpk}
                onChange={(e) => setTargetCpk(parseFloat(e.target.value) || 1.33)}
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-indigo-600/60 rounded-xl text-base text-sky-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <div className="flex items-center gap-1.5">
                {(type === 'gjb' ? [1.67, 1.80, 2.0] : [1.33, 1.50, 1.67]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetCpk(val)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      targetCpk === val 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 模拟数据生成规模 (批次数 & 子组大小) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                生成批次数 (子组总数 k):
              </label>
              <input
                type="number"
                min="10"
                max="200"
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value) || 50)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">审查常用: 30 ~ 50 批</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                子组大小 (每批样本量 n):
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={sampleSize}
                onChange={(e) => setSampleSize(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Xbar-S / R 常用: 5</span>
            </div>
          </div>

          {/* 4. 高级选项折叠：允许临时微调 USL/LSL */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvanced ? '收起高级微调选项' : '如需临时变更工序公差限，请点击展开微调'}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl animate-in fade-in">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">自定义 USL (上限):</label>
                  <input
                    type="number"
                    step="any"
                    value={customUsl}
                    onChange={(e) => setCustomUsl(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-purple-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">自定义 LSL (下限):</label>
                  <input
                    type="number"
                    step="any"
                    value={customLsl}
                    onChange={(e) => setCustomLsl(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-purple-300 font-semibold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 底部提交 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              生成 {batchCount} 批高保真模拟图表 (目标Cpk: {targetCpk})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};