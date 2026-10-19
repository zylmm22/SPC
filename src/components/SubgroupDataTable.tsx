/**
 * 子组数据 Tab 表格组件
 * 严格按照用户需求定义：
 * 核心展示列【只保留】：序号、采集时间、生产批号、工序、设备号
 * 支持【数据作废/剔除异常值重新计算控制限】功能，以及展开查看测量值与判异详情
 */

import React, { useState } from 'react';
import { SubgroupDataPoint, ProcessCharacteristic } from '../types/spc';
import { 
  EyeOff, 
  RotateCcw, 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  Trash2,
  CheckSquare,
  Award,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { AuditLevelMode } from '../types/spc';

interface SubgroupDataTableProps {
  process: ProcessCharacteristic;
  subgroups: SubgroupDataPoint[];
  onVoidSubgroup: (subgroupId: string, reason?: string) => void;
  onRestoreSubgroup: (subgroupId: string) => void;
  onBatchVoid: (subgroupIds: string[], reason: string) => void;
  onBatchRestore: (subgroupIds: string[]) => void;
  auditMode?: AuditLevelMode;
}

export const SubgroupDataTable: React.FC<SubgroupDataTableProps> = ({
  process,
  subgroups,
  onVoidSubgroup,
  onRestoreSubgroup,
  onBatchVoid,
  onBatchRestore,
  auditMode = 'real',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'voided' | 'violation'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [voidReasonModalId, setVoidReasonModalId] = useState<string | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');

  // 过滤数据
  const filteredSubgroups = subgroups.filter(sg => {
    // 搜索词过滤 (生产批号、设备号、工序)
    const matchesSearch = 
      sg.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sg.deviceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sg.processName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'valid') return !sg.isVoided;
    if (statusFilter === 'voided') return sg.isVoided;
    if (statusFilter === 'violation') return !sg.isVoided && sg.violations && sg.violations.length > 0;
    return true;
  });

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSubgroups.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubgroups.map(s => s.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* 顶部工具栏：搜索、状态筛选、批量作废重算 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="搜索生产批号、设备号或工序..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === 'all' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              全部 ({subgroups.length})
            </button>
            <button
              onClick={() => setStatusFilter('valid')}
              className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === 'valid' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              有效样本 ({subgroups.filter(s => !s.isVoided).length})
            </button>
            <button
              onClick={() => setStatusFilter('violation')}
              className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === 'violation' ? 'bg-rose-600 text-white font-medium' : 'text-rose-400 hover:text-rose-300'}`}
            >
              判异超差 ({subgroups.filter(s => !s.isVoided && s.violations && s.violations.length > 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('voided')}
              className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === 'voided' ? 'bg-amber-600 text-white font-medium' : 'text-amber-400 hover:text-amber-300'}`}
            >
              已作废剔除 ({subgroups.filter(s => s.isVoided).length})
            </button>
          </div>
        </div>

        {/* 批量操作工具 */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400">已选 {selectedIds.length} 项</span>
              <button
                onClick={() => {
                  onBatchVoid(selectedIds, '批量作废异常排除');
                  setSelectedIds([]);
                }}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all"
              >
                <EyeOff className="w-3 h-3" />
                批量作废并重算
              </button>
              <button
                onClick={() => {
                  onBatchRestore(selectedIds);
                  setSelectedIds([]);
                }}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                批量恢复
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 审查模拟模式状态横幅 */}
      {auditMode !== 'real' && (
        <div className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs ${
          auditMode === 'cn'
            ? 'bg-sky-950/40 border-sky-800/80 text-sky-200'
            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {auditMode === 'cn' ? <Award className="w-5 h-5 text-sky-400 shrink-0" /> : <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />}
            <div>
              <span className="font-bold">
                【{auditMode === 'cn' ? 'CN 等级审查模拟子组数据' : '国军标 (GJB) 等级审查模拟子组数据'} 已加载】
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">
                按审查要求：本表格已<b>完整抓取真实上传数据的除测量值以外的全部元数据（生产批号、采集时间、工序、设备号、检验员）</b>；测量值已按设定的控制限与 CPK 标准生成。
              </p>
            </div>
          </div>
          <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-emerald-400 shrink-0">
            ● 审查合规
          </span>
        </div>
      )}

      {/* 提示信息栏 */}
      <div className="px-4 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          <span>
            <b>严格展示规范</b>：表格主列仅保留<b>【序号、采集时间、生产批号、工序、设备号】</b>。
            点击“作废/剔除”按钮可即时将该批次排除，系统将自动重新计算控制限！
          </span>
        </div>
        <span className="text-slate-500">提示：点击任意行可展开查看原始测量值与判异分析</span>
      </div>

      {/* 核心数据表格 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredSubgroups.length > 0 && selectedIds.length === filteredSubgroups.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">展开</th>
                <th className="py-3 px-4 w-16">序号</th>
                <th className="py-3 px-5">采集时间</th>
                <th className="py-3 px-5">生产批号</th>
                <th className="py-3 px-5">工序</th>
                <th className="py-3 px-4">设备号</th>
                <th className="py-3 px-4 text-center">状态判定</th>
                <th className="py-3 px-5 text-right">操作 (数据作废/剔除重算)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredSubgroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    未找到符合条件的子组数据
                  </td>
                </tr>
              ) : (
                filteredSubgroups.map(sg => {
                  const isExpanded = expandedRowId === sg.id;
                  const isSelected = selectedIds.includes(sg.id);
                  const hasViolations = sg.violations && sg.violations.length > 0;

                  return (
                    <React.Fragment key={sg.id}>
                      <tr 
                        className={`transition-colors cursor-pointer ${
                          sg.isVoided 
                            ? 'bg-slate-950/40 text-slate-500 line-through' 
                            : hasViolations 
                              ? 'bg-rose-950/20 hover:bg-rose-950/30' 
                              : isSelected 
                                ? 'bg-indigo-950/30' 
                                : 'hover:bg-slate-800/40'
                        }`}
                        onClick={() => setExpandedRowId(isExpanded ? null : sg.id)}
                      >
                        {/* 勾选框 */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(sg.id)}
                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* 展开按钮 */}
                        <td className="py-3 px-3 text-center text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400 inline" /> : <ChevronRight className="w-4 h-4 inline" />}
                        </td>

                        {/* 1. 序号 */}
                        <td className="py-3 px-4 font-mono font-medium text-slate-300">
                          #{sg.seq}
                        </td>

                        {/* 2. 采集时间 */}
                        <td className="py-3 px-5 font-mono text-slate-300 whitespace-nowrap">
                          {sg.sampleTime}
                        </td>

                        {/* 3. 生产批号 */}
                        <td className="py-3 px-5 font-mono font-semibold text-indigo-300">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/80">
                            {sg.batchNo}
                          </span>
                        </td>

                        {/* 4. 工序 */}
                        <td className="py-3 px-5 text-slate-200">
                          {sg.processName}
                        </td>

                        {/* 5. 设备号 */}
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[11px] text-slate-300 border border-slate-700">
                            {sg.deviceNo}
                          </span>
                        </td>

                        {/* 状态徽标 */}
                        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {sg.isVoided ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <EyeOff className="w-3 h-3" />
                              已作废排除
                            </span>
                          ) : hasViolations ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              判异超差 ({sg.violations.length})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              受控正常
                            </span>
                          )}
                        </td>

                        {/* 操作栏：数据作废/剔除重算 */}
                        <td className="py-3 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {sg.isVoided ? (
                            <button
                              onClick={() => onRestoreSubgroup(sg.id)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-md text-xs font-medium transition-all border border-emerald-500/30 inline-flex items-center gap-1"
                              title="恢复此子组并重新计算控制限"
                            >
                              <RotateCcw className="w-3 h-3" />
                              恢复重算
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setVoidReasonModalId(sg.id);
                                setVoidReasonInput('');
                              }}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-md text-xs font-medium transition-all border border-rose-500/30 inline-flex items-center gap-1"
                              title="剔除此子组异常值并自动重新计算控制限"
                            >
                              <EyeOff className="w-3 h-3" />
                              作废/剔除重算
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* 展开的详情面板 (展示原始测量值点阵、均值、极差、违规原因、作废详情) */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90">
                          <td colSpan={9} className="py-3 px-6 border-y border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="space-y-1.5">
                                <span className="font-semibold text-slate-300 block">子组统计详情:</span>
                                <div className="text-slate-400 space-y-0.5">
                                  <div>样本容量: <b className="text-slate-200">{sg.n} 件</b></div>
                                  <div>子组均值 (Mean): <b className="text-sky-400 font-mono">{sg.mean} {process.unit}</b></div>
                                  {sg.range !== undefined && (
                                    <div>子组极差 (Range): <b className="text-purple-400 font-mono">{sg.range} {process.unit}</b></div>
                                  )}
                                  {sg.stdDev !== undefined && sg.stdDev > 0 && (
                                    <div>子组标准差 (S): <b className="text-purple-400 font-mono">{sg.stdDev}</b></div>
                                  )}
                                  {sg.operator && <div>检验员: <b className="text-slate-200">{sg.operator}</b></div>}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <span className="font-semibold text-slate-300 block">各单件原始测量点阵 (x1~xn):</span>
                                {sg.values && sg.values.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {sg.values.map((v, vIdx) => (
                                      <span key={vIdx} className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[11px] text-slate-200 border border-slate-700">
                                        x{vIdx + 1}: {v}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-slate-500">
                                    抽样数: {sg.sampleCount ?? sg.n} 件, 不良/缺陷数: {sg.defectCount ?? 0}
                                  </div>
                                )}
                                {sg.isVoided && sg.voidReason && (
                                  <div className="mt-2 text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-900/60">
                                    <b>作废原因:</b> {sg.voidReason}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <span className="font-semibold text-slate-300 block">Nelson 判异分析:</span>
                                {sg.violations && sg.violations.length > 0 ? (
                                  <div className="space-y-1">
                                    {sg.violations.map((v, vIdx) => (
                                      <div key={vIdx} className="p-1.5 bg-rose-950/40 border border-rose-900/60 rounded text-[11px] text-rose-300">
                                        <b className="text-rose-200">{v.ruleName}</b>: {v.description}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    未触发任何 Nelson 判异异常规则
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 作废原因确认模态框 */}
      {voidReasonModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-base">
              <EyeOff className="w-5 h-5" />
              <span>数据作废与重新计算控制限确认</span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              您即将作废该子组数据。作废后，该批次点将在控制图上被排除，<b>系统将自动剔除其数值并实时重新计算 UCL、CL、LCL 控制限</b>。
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">请填写作废/剔除原因 (可选):</label>
              <input
                type="text"
                placeholder="例如: 调机首件、夹具松动已排除、原材料批次突变等"
                value={voidReasonInput}
                onChange={(e) => setVoidReasonInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidReasonModalId(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onVoidSubgroup(voidReasonModalId, voidReasonInput || '异常值作废排除');
                  setVoidReasonModalId(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition-all"
              >
                确认作废并重新计算控制限
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
