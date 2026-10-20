/**
 * 数据持久化与备份管理模态框
 * 解决用户在 Netlify 纯静态外网部署时数据保存、跨设备数据同步与全量备份恢复需求
 */

import React, { useState, useRef } from 'react';
import { 
  exportSystemBackup, 
  importSystemBackup, 
  resetToFactoryDefaults,
  getStoredProcesses,
  getStoredSubgroupsMap
} from '../utils/storageService';
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileJson, 
  HardDrive,
  Info,
  ExternalLink
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
  showToast: (msg: string) => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentProcesses = getStoredProcesses();
  const subgroupsMap = getStoredSubgroupsMap();
  const totalSubgroupsStored = Object.values(subgroupsMap).reduce((acc, curr) => acc + (curr?.length || 0), 0);

  // 导出备份文件
  const handleExport = () => {
    try {
      const jsonStr = exportSystemBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `SPC系统数据全量备份_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('已成功导出系统完整数据备份 (.json)！');
    } catch (e: any) {
      showToast(`导出失败: ${e.message}`);
    }
  };

  // 触发文件选择
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // 处理导入文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = importSystemBackup(content);
        if (res.success) {
          showToast(res.message);
          setImportStatus('恢复成功！数据已更新');
          onDataRestored();
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setImportStatus(`错误: ${res.message}`);
          showToast(res.message);
        }
      } catch (err: any) {
        setImportStatus(`导入失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 重置回出厂默认数据
  const handleResetDefaults = () => {
    if (window.confirm('确定要清空本地所有自定义数据并恢复为系统出厂预设吗？此操作无法撤销。')) {
      resetToFactoryDefaults();
      showToast('已重置回系统出厂预置数据');
      onDataRestored();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">数据持久化与全量备份</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                支持 Netlify 纯前端外网访问自动保存、跨设备导出与一键恢复
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Netlify 外网访问原理说明 */}
          <div className="p-3.5 bg-indigo-950/30 border border-indigo-800/60 rounded-xl text-xs space-y-1.5 text-indigo-200">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Netlify 部署持久化保障机制说明</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Netlify 为纯静态 Web 托管，没有常驻后端数据库。系统现已全面升级为<b>本地存储双向持久化引擎</b>：您上传的 Excel 数据、追加的新批次、新建/删除的工序以及作废标记，均会在您的浏览器中<b>自动永久保存</b>，刷新或重新打开页面数据不再丢失！
            </p>
          </div>

          {/* 当前已保存的数据资产概览 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                已保存工序特性
              </div>
              <div className="text-xl font-bold font-mono text-indigo-400">
                {currentProcesses.length} <span className="text-xs text-slate-400 font-normal">个工序</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-slate-500" />
                已保存子组批次
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {totalSubgroupsStored} <span className="text-xs text-slate-400 font-normal">批数据</span>
              </div>
            </div>
          </div>

          {/* 备份与迁移操作 */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              数据备份与跨电脑同步
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 导出 JSON 备份 */}
              <button
                onClick={handleExport}
                className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-600/60 rounded-xl flex items-center gap-3 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-200">导出系统备份 (.json)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">下载包含全部工序与批次的数据包</div>
                </div>
              </button>

              {/* 导入 JSON 恢复 */}
              <button
                onClick={handleSelectFile}
                className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-600/60 rounded-xl flex items-center gap-3 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-200">导入备份文件恢复</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">从 JSON 备份恢复其他电脑的数据</div>
                </div>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {importStatus && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-indigo-500/50 text-indigo-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>

          {/* 危险区：重置出厂数据 */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-300">恢复出厂预置数据</div>
              <div className="text-[11px] text-slate-500">清空所有本地保存的修改，恢复为出厂标准工序</div>
            </div>
            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复出厂
            </button>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
