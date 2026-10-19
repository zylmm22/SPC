/**
 * Excel 模板手动搭建器与批量数据导入解析器
 * 核心功能：
 * 1. 手动搭建 Excel 模板样式 (配置字段、样本容量波动/固定输入框、测量列等)
 * 2. 一键导出标准 .xlsx 模板
 * 3. 批量上传 Excel 文件，自动按照【生产批号】聚合子组并导入系统
 */

import React, { useState } from 'react';
import { ProcessCharacteristic, SubgroupDataPoint, SPCChartType } from '../types/spc';
import { downloadExcelTemplate, parseUploadedExcel, TemplateBuilderConfig } from '../utils/excelHelper';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Settings2, 
  Check, 
  AlertCircle, 
  Layers, 
  RefreshCw,
  Plus,
  Table as TableIcon
} from 'lucide-react';

interface ExcelTemplateManagerProps {
  currentProcess: ProcessCharacteristic;
  existingCount?: number;
  onUpdateProcess: (updated: ProcessCharacteristic) => void;
  onImportSubgroups: (newSubgroups: SubgroupDataPoint[], mode: 'replace' | 'append') => void;
  onResetDemoData: () => void;
}

export const ExcelTemplateManager: React.FC<ExcelTemplateManagerProps> = ({
  currentProcess,
  existingCount = 0,
  onUpdateProcess,
  onImportSubgroups,
  onResetDemoData,
}) => {
  // 模板搭建器状态
  const [templateTitle, setTemplateTitle] = useState(`${currentProcess.name}数据采集模板`);
  const [chartType, setChartType] = useState<SPCChartType>(currentProcess.chartType);
  const [isSampleVariable, setIsSampleVariable] = useState<boolean>(currentProcess.isSampleVariable);
  const [sampleSize, setSampleSize] = useState<number>(currentProcess.sampleSize || 5);
  const [includeInspector, setIncludeInspector] = useState<boolean>(false);
  const [unit, setUnit] = useState<string>(currentProcess.unit || 'mm');

  // 上传与解析状态
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    subgroups: SubgroupDataPoint[];
    totalRows: number;
    totalBatches: number;
  } | null>(null);

  // 下载搭建好的模板
  const handleDownload = () => {
    const config: TemplateBuilderConfig = {
      templateTitle,
      chartType,
      processName: currentProcess.processName,
      deviceNo: currentProcess.deviceList[0] || 'CNC-01',
      sampleSize,
      unit,
      includeInspector
    };
    downloadExcelTemplate(config);
  };

  // 处理文件上传解析
  const handleFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setParsedPreview(null);

    try {
      const result = await parseUploadedExcel(file, currentProcess);
      if (result.subgroups.length === 0) {
        throw new Error('未能在上传的文件中解析出有效的生产批号或测量数据');
      }
      setParsedPreview({
        subgroups: result.subgroups,
        totalRows: result.summary.totalRows,
        totalBatches: result.summary.totalBatches
      });
    } catch (err: any) {
      setUploadError(err.message || 'Excel 文件读取失败，请检查文件格式');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // 确认导入并生效 (支持全量覆盖与增量追加两种模式)
  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.subgroups.length === 0) return;
    onImportSubgroups(parsedPreview.subgroups, importMode);
    setParsedPreview(null);
  };

  const isVariableChart = ['xbar-r', 'xbar-s', 'i-mr'].includes(chartType);

  return (
    <div className="space-y-6">
      {/* 模块一：Excel 模板样式手动搭建器 */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Excel 模板样式手动搭建器</h3>
              <p className="text-xs text-slate-400">
                按需定制子组容量规则、控制图类型及表头字段，并一键导出标准 Excel 模板
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            下载定制 Excel 模板 (.xlsx)
          </button>
        </div>

        {/* 搭建参数表单 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* 控制图类型 */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">适用控制图类型:</label>
            <select
              value={chartType}
              onChange={(e) => {
                const ct = e.target.value as SPCChartType;
                setChartType(ct);
                if (ct === 'i-mr') setSampleSize(1);
                else if (ct === 'xbar-r') setSampleSize(5);
                else if (ct === 'xbar-s') setSampleSize(10);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <optgroup label="计量型控制图 (Variables)">
                <option value="xbar-r">均值-极差图 (Xbar-R, 样本 n=2~9)</option>
                <option value="xbar-s">均值-标准差图 (Xbar-S, 样本 n≥10)</option>
                <option value="i-mr">单值-移动极差图 (I-MR, 样本 n=1)</option>
              </optgroup>
              <optgroup label="计数型控制图 (Attributes)">
                <option value="p">不良率图 (P图, 样本容量可波动)</option>
                <option value="np">不良品数图 (NP图, 样本容量固定)</option>
                <option value="c">缺陷数图 (C图, 检验面积固定)</option>
                <option value="u">单位缺陷数图 (U图, 检验批次波动)</option>
              </optgroup>
            </select>
          </div>

          {/* 子组样本容量 n 规则 (按要求提供输入框与波动选项) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-medium">子组样本容量 (n):</label>
              <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSampleVariable}
                  onChange={(e) => setIsSampleVariable(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>容量波动(非固定)</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5000"
                value={sampleSize}
                disabled={chartType === 'i-mr'}
                onChange={(e) => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 disabled:opacity-50 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-slate-400">
                {isVariableChart ? '件/批次' : '抽样基数'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isSampleVariable ? '建立工序规则：允许各批次抽样数量波动' : '建立工序规则：每批固定抽样数量'}
            </p>
          </div>

          {/* 测量单位与可选列 */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">工程测量单位:</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="如 mm, V, MPa, %, 个"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <label className="flex items-center gap-2 text-slate-300 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInspector}
                onChange={(e) => setIncludeInspector(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>在模板中包含【检验员】扩展列</span>
            </label>
          </div>
        </div>

        {/* 动态搭建的模板样式网格预览 */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-300">
            <TableIcon className="w-4 h-4 text-indigo-400" />
            <span>模板表头与样式搭建实时预览:</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-[11px] font-mono text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-indigo-300">
                <tr>
                  <th className="py-2 px-3 border-r border-slate-800">序号</th>
                  <th className="py-2 px-3 border-r border-slate-800">采集时间</th>
                  <th className="py-2 px-4 border-r border-slate-800 bg-indigo-950/40 text-sky-300">
                    生产批号 (聚合子组)
                  </th>
                  <th className="py-2 px-3 border-r border-slate-800">工序</th>
                  <th className="py-2 px-3 border-r border-slate-800">设备号</th>
                  {includeInspector && <th className="py-2 px-3 border-r border-slate-800">检验员</th>}
                  {chartType === 'i-mr' ? (
                    <th className="py-2 px-4 bg-emerald-950/40 text-emerald-300">单值测量点 ({unit})</th>
                  ) : isVariableChart ? (
                    Array.from({ length: Math.min(sampleSize, 8) }).map((_, i) => (
                      <th key={i} className="py-2 px-3 border-r border-slate-800 bg-emerald-950/30 text-emerald-300">
                        测量值 x{i + 1} ({unit})
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="py-2 px-3 border-r border-slate-800 bg-amber-950/30 text-amber-300">抽样总数 (n)</th>
                      <th className="py-2 px-3 bg-rose-950/30 text-rose-300">
                        {chartType === 'p' || chartType === 'np' ? '不合格品数 (d)' : '缺陷总数 (c)'}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-900/50">
                  <td className="py-2 px-3 border-r border-slate-800 text-slate-500">1</td>
                  <td className="py-2 px-3 border-r border-slate-800 text-slate-400">2026-10-15 09:30:00</td>
                  <td className="py-2 px-4 border-r border-slate-800 text-sky-400 font-bold">LOT-20261015-001</td>
                  <td className="py-2 px-3 border-r border-slate-800">{currentProcess.processName}</td>
                  <td className="py-2 px-3 border-r border-slate-800">CNC-01</td>
                  {includeInspector && <td className="py-2 px-3 border-r border-slate-800">QC-01</td>}
                  {chartType === 'i-mr' ? (
                    <td className="py-2 px-4 text-emerald-400 font-bold">25.002</td>
                  ) : isVariableChart ? (
                    Array.from({ length: Math.min(sampleSize, 8) }).map((_, i) => (
                      <td key={i} className="py-2 px-3 border-r border-slate-800 text-emerald-400">
                        {(25.000 + (i - 2) * 0.003).toFixed(3)}
                      </td>
                    ))
                  ) : (
                    <>
                      <td className="py-2 px-3 border-r border-slate-800 text-amber-400">{sampleSize}</td>
                      <td className="py-2 px-3 text-rose-400">2</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 模块二：Excel 文件批量导入与按批号聚合 */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Excel 表格批量上传与子组聚合</h3>
              <p className="text-xs text-slate-400">
                支持 .xlsx, .xls, .csv 格式。系统将<b>按照生产批号 (Batch No)</b> 自动聚合并计算子组统计量
              </p>
            </div>
          </div>

          <button
            onClick={onResetDemoData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            title="恢复内置的25批真实工业仿真数据"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重置为标准工业样例
          </button>
        </div>

        {/* 拖拽上传框 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging 
              ? 'border-indigo-500 bg-indigo-500/10' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
          }`}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls, .csv';
            input.onchange = (e: any) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            };
            input.click();
          }}
        >
          <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-200">
            点击选择或拖拽 Excel / CSV 表格至此处上传
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            支持标准模板与自定义表头，系统自动识别【生产批号、采集时间、工序、设备号、测量值点阵】
          </p>
          <span className="inline-block mt-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow transition-all">
            浏览本地文件
          </span>
        </div>

        {/* 错误提示 */}
        {uploadError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* 上传解析结果预览与确认入库 */}
        {parsedPreview && (
          <div className="p-4 bg-slate-950 border border-emerald-900/60 rounded-xl space-y-3.5">
            {/* 顶部解析成功提示 */}
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                Excel 解析成功！共读取 {parsedPreview.totalRows} 行数据，按生产批号聚合为 {parsedPreview.totalBatches} 个有效子组。
              </span>
            </div>

            {/* 导入模式选择卡片：全量覆盖 vs 增量追加 */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  请选择数据导入模式:
                </span>
                <span className="text-[11px] text-slate-400">
                  当前工序已有历史数据: <b className="text-sky-400 font-mono">{existingCount}</b> 批
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* 模式 1: 全量覆盖 */}
                <label 
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                    importMode === 'replace' 
                      ? 'bg-rose-950/30 border-rose-500/70 text-slate-200 shadow-sm ring-1 ring-rose-500/30' 
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-rose-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-100 flex items-center gap-1">
                      全量清空覆盖模式
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      清空当前已有全部旧批次，完全以新上传的 <b>{parsedPreview.totalBatches} 批</b> 数据为准重新分析与计算控制限。
                    </p>
                  </div>
                </label>

                {/* 模式 2: 增量追加 */}
                <label 
                  onClick={() => setImportMode('append')}
                  className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                    importMode === 'append' 
                      ? 'bg-indigo-950/40 border-indigo-500 text-slate-200 shadow-sm ring-1 ring-indigo-500/40' 
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                      增量追加模式 (保留历史)
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                        常态监控
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      保留原有的 <b>{existingCount} 批</b> 历史数据，将新上传批次顺延追加至末尾（合并后共计 <b>{existingCount + parsedPreview.totalBatches} 批</b>）。
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 操作确认栏 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-400">
                {importMode === 'replace' ? (
                  <span className="text-amber-400">
                    ⚠️ 提示：执行后将重置原有历史数据，生成基于新样本的独立控制图。
                  </span>
                ) : (
                  <span className="text-indigo-300">
                    ✨ 提示：执行后将把新上传的 {parsedPreview.totalBatches} 批数据与原有数据合并，自动按时间序重新排列并刷新控制限。
                  </span>
                )}
              </div>

              <button
                onClick={handleConfirmImport}
                className={`px-5 py-2 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 ${
                  importMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                <Check className="w-4 h-4" />
                {importMode === 'replace' ? '确认清空旧数据并全量覆盖' : `确认增量追加并合并 (共 ${existingCount + parsedPreview.totalBatches} 批)`}
              </button>
            </div>

            {/* 聚合子组简略预览 */}
            <div className="overflow-x-auto max-h-48 overflow-y-auto rounded border border-slate-800">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead className="bg-slate-900 sticky top-0 text-slate-400">
                  <tr>
                    <th className="py-1.5 px-3">序号</th>
                    <th className="py-1.5 px-3">生产批号</th>
                    <th className="py-1.5 px-3">工序</th>
                    <th className="py-1.5 px-3">设备号</th>
                    <th className="py-1.5 px-3">样本容量 (n)</th>
                    <th className="py-1.5 px-3 font-mono">子组均值</th>
                    <th className="py-1.5 px-3 font-mono">极差 R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {parsedPreview.subgroups.slice(0, 5).map(sg => (
                    <tr key={sg.id} className="hover:bg-slate-900/40">
                      <td className="py-1.5 px-3">#{sg.seq}</td>
                      <td className="py-1.5 px-3 font-mono text-sky-400">{sg.batchNo}</td>
                      <td className="py-1.5 px-3">{sg.processName}</td>
                      <td className="py-1.5 px-3">{sg.deviceNo}</td>
                      <td className="py-1.5 px-3">{sg.n}</td>
                      <td className="py-1.5 px-3 font-mono text-emerald-400">{sg.mean}</td>
                      <td className="py-1.5 px-3 font-mono">{sg.range ?? '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedPreview.subgroups.length > 5 && (
              <p className="text-[10px] text-slate-500 text-center">
                ... 仅展示前 5 个聚合子组预览，共 {parsedPreview.subgroups.length} 组数据
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
