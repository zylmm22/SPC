/**
 * CN等级 / 国军标等级 审查参数设定模态框
 * 首次点击输入，输入后自动持久化，后续一键切换并自动模拟仿真数据
 */

import React, { useState, useEffect } from 'react';
import { ProcessCharacteristic, ControlLimits, CNAuditConfig, GJBAuditConfig } from '../types/spc';
import { ShieldCheck, Award, X, Sparkles, Check, AlertCircle } from 'lucide-react';

interface AuditParamModalProps {
  isOpen: boolean;
  type: 'cn' | 'gjb';
  process: ProcessCharacteristic;
  currentLimits: ControlLimits;
  initialCnConfig: CNAuditConfig;
  initialGjbConfig: GJBAuditConfig;
  onClose: () => void;
  onSaveCnConfig: (config: CNAuditConfig) => void;
  onSaveGjbConfig: (config: GJBAuditConfig) => void;
}

export const AuditParamModal: React.FC<AuditParamModalProps> = ({
  isOpen,
  type,
  process,
  currentLimits,
  initialCnConfig,
  initialGjbConfig,
  onClose,
  onSaveCnConfig,
  onSaveGjbConfig,
}) => {
  // CN等级表单状态
  const [cnTargetCpk, setCnTargetCpk] = useState<number>(initialCnConfig.targetCpk || 1.33);
  const [cnUcl, setCnUcl] = useState<number>(initialCnConfig.ucl || currentLimits.ucl || 25.018);
  const [cnCl, setCnCl] = useState<number>(initialCnConfig.cl || currentLimits.cl || 25.000);
  const [cnLcl, setCnLcl] = useState<number>(initialCnConfig.lcl || currentLimits.lcl || 24.982);
  const [cnUsl, setCnUsl] = useState<number>(initialCnConfig.usl || process.usl || 25.025);
  const [cnSl, setCnSl] = useState<number>(initialCnConfig.sl || process.sl || 25.000);
  const [cnLsl, setCnLsl] = useState<number>(initialCnConfig.lsl || process.lsl || 24.975);

  // 国军标等级表单状态
  const [gjbTargetCpk, setGjbTargetCpk] = useState<number>(initialGjbConfig.targetCpk || 1.67);
  const [gjbUsl, setGjbUsl] = useState<number>(initialGjbConfig.usl || process.usl || 25.025);
  const [gjbSl, setGjbSl] = useState<number>(initialGjbConfig.sl || process.sl || 25.000);
  const [gjbLsl, setGjbLsl] = useState<number>(initialGjbConfig.lsl || process.lsl || 24.975);

  useEffect(() => {
    if (initialCnConfig.isConfigured) {
      setCnTargetCpk(initialCnConfig.targetCpk);
      setCnUcl(initialCnConfig.ucl);
      setCnCl(initialCnConfig.cl);
      setCnLcl(initialCnConfig.lcl);
      setCnUsl(initialCnConfig.usl);
      setCnSl(initialCnConfig.sl);
      setCnLsl(initialCnConfig.lsl);
    }
  }, [initialCnConfig]);

  useEffect(() => {
    if (initialGjbConfig.isConfigured) {
      setGjbTargetCpk(initialGjbConfig.targetCpk);
      setGjbUsl(initialGjbConfig.usl);
      setGjbSl(initialGjbConfig.sl);
      setGjbLsl(initialGjbConfig.lsl);
    }
  }, [initialGjbConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'cn') {
      onSaveCnConfig({
        targetCpk: Number(cnTargetCpk),
        ucl: Number(cnUcl),
        cl: Number(cnCl),
        lcl: Number(cnLcl),
        usl: Number(cnUsl),
        sl: Number(cnSl),
        lsl: Number(cnLsl),
        isConfigured: true
      });
    } else {
      onSaveGjbConfig({
        targetCpk: Number(gjbTargetCpk),
        usl: Number(gjbUsl),
        sl: Number(gjbSl),
        lsl: Number(gjbLsl),
        isConfigured: true
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-100">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 标题 */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className={`p-2.5 rounded-xl border ${
            type === 'cn' 
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {type === 'cn' ? <Award className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {type === 'cn' ? 'CN 等级审查参数配置' : '国军标 (GJB) 等级审查参数配置'}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                用于体系审查使用
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {type === 'cn' 
                ? '首次配置输入基础数据要求，系统将抓取真实批号/日期，自动反推生成符合要求的数据与图表' 
                : '设定国军标严苛质量规范上下限，自动生成符合军标高可靠性标准的高CPK受控图表'}
            </p>
          </div>
        </div>

        {/* 提示条目 */}
        <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">免重复输入设计：</span>
            <p className="text-[11px] text-slate-400">
              本次保存后系统将<b>自动记住此配置</b>，后续在页面上点击按钮将直接一键切换模拟图，无需再次输入；如需调整可随时点击“修改审查参数”。
            </p>
          </div>
        </div>

        {/* 参数表单 */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {type === 'cn' ? (
            // ================== CN 等级表单 ==================
            <div className="space-y-3.5">
              {/* CPK 要求 */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-sky-300">
                    1. 目标 CPK 要求值:
                  </label>
                  <span className="text-[11px] text-slate-400">
                    常见标准: 1.33 (合格) / 1.50 / 1.67 (优秀)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="3.0"
                    required
                    value={cnTargetCpk}
                    onChange={(e) => setCnTargetCpk(parseFloat(e.target.value) || 1.33)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-sky-400 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCnTargetCpk(1.33)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded"
                    >
                      1.33
                    </button>
                    <button
                      type="button"
                      onClick={() => setCnTargetCpk(1.50)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded"
                    >
                      1.50
                    </button>
                    <button
                      type="button"
                      onClick={() => setCnTargetCpk(1.67)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded"
                    >
                      1.67
                    </button>
                  </div>
                </div>
              </div>

              {/* 控制上下限要求 (UCL, CL, LCL) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-rose-300 block">
                  2. 控制限要求 (UCL / CL / LCL):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">控制上限 (UCL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnUcl}
                      onChange={(e) => setCnUcl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">中心线 (CL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnCl}
                      onChange={(e) => setCnCl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">控制下限 (LCL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnLcl}
                      onChange={(e) => setCnLcl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* 规范上下限 (USL, SL, LSL) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-purple-300 block">
                  3. 规范上下限要求 (USL / SL / LSL):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">规范上限 (USL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnUsl}
                      onChange={(e) => setCnUsl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">中心目标 (SL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnSl}
                      onChange={(e) => setCnSl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">规范下限 (LSL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cnLsl}
                      onChange={(e) => setCnLsl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // ================== 国军标等级表单 ==================
            <div className="space-y-3.5">
              {/* 国军标规范限 */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-amber-300 block">
                  1. 国军标规范上下限输入 (USL / SL / LSL):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">规范上限 (USL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={gjbUsl}
                      onChange={(e) => setGjbUsl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">中心目标 (SL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={gjbSl}
                      onChange={(e) => setGjbSl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">规范下限 (LSL):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={gjbLsl}
                      onChange={(e) => setGjbLsl(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 军标可靠性等级 (Cpk) */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-400">
                    2. 国军标可靠性能力等级要求 (Cpk):
                  </label>
                  <span className="text-[11px] text-emerald-300 font-mono">
                    默认严苛标准: 1.67 (A+级特优)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    max="3.0"
                    value={gjbTargetCpk}
                    onChange={(e) => setGjbTargetCpk(parseFloat(e.target.value) || 1.67)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGjbTargetCpk(1.67)}
                      className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[11px] rounded"
                    >
                      1.67 (推荐)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGjbTargetCpk(2.00)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded"
                    >
                      2.00 (超特优)
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  国军标严苛质量体系强调六西格玛水平，系统将自动配置紧凑方差与对称正态拟合，确保 100% 满足审查抽查要求。
                </p>
              </div>
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 ${
                type === 'cn'
                  ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              }`}
            >
              <Check className="w-4 h-4" />
              {type === 'cn' ? '保存并生成 CN 等级审查图' : '保存并生成国军标等级审查图'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
