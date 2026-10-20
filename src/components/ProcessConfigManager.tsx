/**
 * 工序与质量特性配置管理组件
 * 允许用户添加、编辑、删除工序特性，设置样本容量波动规则与工程公差 (USL, SL, LSL)
 */

import React, { useState, useEffect } from 'react';
import { ProcessCharacteristic, SPCChartType } from '../types/spc';
import { NELSON_8_RULES } from '../utils/spcConstants';
import { Settings, Plus, Check, Sliders, Cpu, Wrench, Trash2, AlertTriangle, X, Lock, Eye } from 'lucide-react';

interface ProcessConfigManagerProps {
  processes: ProcessCharacteristic[];
  activeProcessId: string;
  onSelectProcess: (processId: string) => void;
  onAddProcess: (newProcess: ProcessCharacteristic) => void;
  onUpdateProcess: (updated: ProcessCharacteristic) => void;
  onDeleteProcess: (processId: string) => void;
  isAdmin?: boolean;
}

export const ProcessConfigManager: React.FC<ProcessConfigManagerProps> = ({
  processes,
  activeProcessId,
  onSelectProcess,
  onAddProcess,
  onUpdateProcess,
  onDeleteProcess,
  isAdmin = true,
}) => {
  const currentProcess = processes.find(p => p.id === activeProcessId) || processes[0];

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [confirmDeleteProcess, setConfirmDeleteProcess] = useState<ProcessCharacteristic | null>(null);

  const [formData, setFormData] = useState<Partial<ProcessCharacteristic>>({
    name: currentProcess?.name || '',
    processName: currentProcess?.processName || '',
    chartType: currentProcess?.chartType || 'xbar-r',
    unit: currentProcess?.unit || 'mm',
    sampleSize: currentProcess?.sampleSize || 5,
    isSampleVariable: currentProcess?.isSampleVariable || false,
    usl: currentProcess?.usl,
    sl: currentProcess?.sl,
    lsl: currentProcess?.lsl,
    deviceList: currentProcess?.deviceList || [],
    description: currentProcess?.description || '',
    activeRules: currentProcess?.activeRules || [1, 2, 3, 4, 5, 6, 7, 8]
  });

  // 当切换选中工序时，同步更新表单数据
  useEffect(() => {
    if (!isCreatingNew && currentProcess) {
      setFormData({
        name: currentProcess.name,
        processName: currentProcess.processName,
        chartType: currentProcess.chartType,
        unit: currentProcess.unit,
        sampleSize: currentProcess.sampleSize,
        isSampleVariable: currentProcess.isSampleVariable,
        usl: currentProcess.usl,
        sl: currentProcess.sl,
        lsl: currentProcess.lsl,
        deviceList: currentProcess.deviceList,
        description: currentProcess.description,
        activeRules: currentProcess.activeRules
      });
    }
  }, [activeProcessId, currentProcess, isCreatingNew]);

  const handleSave = () => {
    if (isCreatingNew) {
      const newProc: ProcessCharacteristic = {
        id: `proc-${Date.now()}`,
        name: formData.name || '新建质量特性',
        processName: formData.processName || '加工工序',
        chartType: formData.chartType || 'xbar-r',
        unit: formData.unit || 'mm',
        sampleSize: formData.sampleSize || 5,
        isSampleVariable: !!formData.isSampleVariable,
        usl: formData.usl,
        sl: formData.sl,
        lsl: formData.lsl,
        deviceList: formData.deviceList && formData.deviceList.length > 0 ? formData.deviceList : ['M-01', 'M-02'],
        description: formData.description || '用户自定义工序',
        activeRules: formData.activeRules || [1, 2, 3, 4, 5, 6, 7, 8]
      };
      onAddProcess(newProc);
      setIsCreatingNew(false);
    } else {
      if (!currentProcess) return;
      onUpdateProcess({
        ...currentProcess,
        ...formData
      } as ProcessCharacteristic);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* 左侧：工序特性库列表 */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-300">工序与质量特性库</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
              {processes.length}
            </span>
          </div>
          {isAdmin ? (
            <button
              onClick={() => {
                setIsCreatingNew(true);
                setFormData({
                  name: '精密轴套外径精车',
                  processName: '精车工序 OP30',
                  chartType: 'xbar-r',
                  unit: 'mm',
                  sampleSize: 5,
                  isSampleVariable: false,
                  usl: 50.02,
                  sl: 50.00,
                  lsl: 49.98,
                  deviceList: ['CNC-LATHE-01', 'CNC-LATHE-02'],
                  activeRules: [1, 2, 3, 4, 5, 6, 7, 8]
                });
              }}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1 transition-all shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              新增工序
            </button>
          ) : (
            <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3" />
              访客只读
            </span>
          )}
        </div>

        <div className="space-y-2">
          {processes.map(proc => {
            const isSelected = proc.id === activeProcessId && !isCreatingNew;
            return (
              <div
                key={proc.id}
                onClick={() => {
                  onSelectProcess(proc.id);
                  setIsCreatingNew(false);
                  setFormData(proc);
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                  isSelected 
                    ? 'bg-indigo-950/40 border-indigo-600 text-slate-100 shadow-md' 
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-slate-200 truncate flex-1" title={proc.name}>
                    {proc.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300">
                      {proc.chartType}
                    </span>
                    {/* 工序快捷删除按钮 (仅管理员可见) */}
                    {isAdmin && (
                      <button
                        type="button"
                        title={processes.length <= 1 ? "系统至少需保留一个工序特性" : `删除工序【${proc.name}】`}
                        disabled={processes.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (processes.length > 1) {
                            setConfirmDeleteProcess(proc);
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate max-w-[140px]">{proc.processName}</span>
                  <span>容量: {proc.isSampleVariable ? '波动' : `n=${proc.sampleSize}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右侧：工序参数与公差配置表单 */}
      <div className="md:col-span-2 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              {isCreatingNew ? '建立新工序与 SPC 控制图规则' : `配置工序规则: ${currentProcess?.name || '未选择'}`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                {/* 取消新增按钮 */}
                {isCreatingNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      if (currentProcess) setFormData(currentProcess);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
                  >
                    取消新增
                  </button>
                )}

                {/* 删除此工序按钮 */}
                {!isCreatingNew && currentProcess && (
                  <button
                    type="button"
                    disabled={processes.length <= 1}
                    title={processes.length <= 1 ? "系统至少需保留一个工序特性，无法删除" : `删除当前工序【${currentProcess.name}】`}
                    onClick={() => {
                      if (processes.length > 1) {
                        setConfirmDeleteProcess(currentProcess);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除此工序
                  </button>
                )}

                {/* 保存配置按钮 */}
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isCreatingNew ? '创建并启用工序' : '保存配置'}
                </button>
              </>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>访客只读模式 (不可更改工序配置)</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">质量特性名称:</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">工序名称 (如 精磨 OP40):</label>
            <input
              type="text"
              value={formData.processName || ''}
              onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">控制图类型:</label>
            <select
              value={formData.chartType || 'xbar-r'}
              onChange={(e) => setFormData({ ...formData, chartType: e.target.value as SPCChartType })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="xbar-r">均值-极差图 (Xbar-R, 样本 n=2~9)</option>
              <option value="xbar-s">均值-标准差图 (Xbar-S, 样本 n≥10)</option>
              <option value="i-mr">单值-移动极差图 (I-MR, 样本 n=1)</option>
              <option value="p">不良率图 (P图)</option>
              <option value="np">不合格品数图 (NP图)</option>
              <option value="c">缺陷数图 (C图)</option>
              <option value="u">单位缺陷数图 (U图)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">工程单位:</label>
            <input
              type="text"
              value={formData.unit || ''}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* 子组样本容量与波动输入框 (按需求 2 提供) */}
          <div className="space-y-1 md:col-span-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200">子组容量划分规则 (Subgroup Rule)</span>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={!!formData.isSampleVariable}
                  onChange={(e) => setFormData({ ...formData, isSampleVariable: e.target.checked })}
                  className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>样本容量是否波动 (可变容量)</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">基准每批抽检样本容量 (n):</span>
              <input
                type="number"
                min="1"
                max="5000"
                value={formData.sampleSize || 5}
                onChange={(e) => setFormData({ ...formData, sampleSize: parseInt(e.target.value) || 1 })}
                className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500 text-[11px]">
                {formData.isSampleVariable ? '（各批次允许依据实际生产抽样数动态计算控制限）' : '（各批次固定按此数量抽样）'}
              </span>
            </div>
          </div>

          {/* 工程公差与规格限 */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">规格上限 (USL):</label>
            <input
              type="number"
              step="any"
              value={formData.usl !== undefined ? formData.usl : ''}
              onChange={(e) => setFormData({ ...formData, usl: parseFloat(e.target.value) || undefined })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">目标中心值 (SL):</label>
            <input
              type="number"
              step="any"
              value={formData.sl !== undefined ? formData.sl : ''}
              onChange={(e) => setFormData({ ...formData, sl: parseFloat(e.target.value) || undefined })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">规格下限 (LSL):</label>
            <input
              type="number"
              step="any"
              value={formData.lsl !== undefined ? formData.lsl : ''}
              onChange={(e) => setFormData({ ...formData, lsl: parseFloat(e.target.value) || undefined })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">关联设备编号 (逗号分隔):</label>
            <input
              type="text"
              value={(formData.deviceList || []).join(', ')}
              onChange={(e) => setFormData({ 
                ...formData, 
                deviceList: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
              })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 删除工序确认模态弹窗 */}
      {confirmDeleteProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">确认删除该工序特性？</h4>
                <span className="text-xs text-rose-400 font-mono">
                  {confirmDeleteProcess.name} [{confirmDeleteProcess.chartType.toUpperCase()}]
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <p className="font-semibold text-slate-200">删除警告：</p>
              <p className="text-slate-400 leading-relaxed">
                您即将删除工序【<b className="text-slate-100">{confirmDeleteProcess.name}</b>】（工序名称：{confirmDeleteProcess.processName}）。
                删除后，该工序的所有公差配置以及对应的历史子组批次数据将被永久移除，<b>此操作不可撤销</b>。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteProcess(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProcess(confirmDeleteProcess.id);
                  setConfirmDeleteProcess(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
