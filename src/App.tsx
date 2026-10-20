/**
 * 智能 SPC 统计过程控制系统 - 主应用程序
 * 严格遵照工业制造质量控制规范与用户定制需求实现
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ProcessCharacteristic, 
  SubgroupDataPoint, 
  ControlLimits, 
  SPCChartType,
  AuditLevelMode,
  CNAuditConfig,
  GJBAuditConfig,
  UserAccount
} from './types/spc';
import { INITIAL_PROCESSES, generateInitialSubgroups } from './data/mockData';
import { 
  calculateControlLimits, 
  evaluateNelsonRules, 
  calculateProcessCapability,
  generateAuditSimulationSubgroups
} from './utils/spcEngine';
import { 
  getStoredProcesses, 
  saveStoredProcesses, 
  getStoredSubgroupsForProcess, 
  saveStoredSubgroupsForProcess,
  getStoredActiveProcessId,
  saveStoredActiveProcessId,
  getStoredCurrentUser,
  saveStoredCurrentUser,
  getStoredCNConfig,
  saveStoredCNConfig,
  getStoredGJBConfig,
  saveStoredGJBConfig,
  PRESET_USERS
} from './utils/storageService';

import { SPCChart } from './components/SPCChart';
import { SubgroupDataTable } from './components/SubgroupDataTable';
import { ProcessCapabilityView } from './components/ProcessCapabilityView';
import { ExcelTemplateManager } from './components/ExcelTemplateManager';
import { ProcessConfigManager } from './components/ProcessConfigManager';
import { AuditParamModal } from './components/AuditParamModal';
import { AccountAuthModal } from './components/AccountAuthModal';
import { DataBackupModal } from './components/DataBackupModal';

import { 
  LineChart, 
  Table, 
  BarChart3, 
  FileSpreadsheet, 
  Sliders, 
  ShieldCheck, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Layers,
  Sparkles,
  Award,
  Settings,
  HelpCircle,
  Eye,
  Lock,
  Database,
  User,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

// ================= 页面主题工具函数 (内置内联，无需外部文件) =================
export type ThemeMode = 'system' | 'dark' | 'light';
const THEME_STORAGE_KEY = 'spc_theme_mode';

function getStoredThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    if (saved && ['system', 'dark', 'light'].includes(saved)) return saved;
  } catch (e) {}
  return 'system';
}

function saveStoredThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {}
}

function isDarkActive(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const isDark = isDarkActive(mode);
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
}

export default function App() {
  // ================= 账号与权限控制状态 =================
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getStoredCurrentUser());
  const isAdmin = currentUser.role === 'admin';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // ================= 页面主题控制 (系统 / 深色 / 浅色) =================
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [isDark, setIsDark] = useState<boolean>(() => isDarkActive(getStoredThemeMode()));
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // 监听并应用主题切换
  useEffect(() => {
    applyThemeToDOM(themeMode);
    setIsDark(isDarkActive(themeMode));
    saveStoredThemeMode(themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode === 'system') {
        applyThemeToDOM('system');
        setIsDark(isDarkActive('system'));
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setShowThemeMenu(false);
    const label = mode === 'system' ? '跟随系统' : mode === 'dark' ? '深色模式' : '浅色模式';
    showToast(`已切换至【${label}】`);
  };

  // ================= 工序特性与数据集合 =================
  const [processes, setProcesses] = useState<ProcessCharacteristic[]>(() => getStoredProcesses());
  const [activeProcessId, setActiveProcessId] = useState<string>(() => {
    const procs = getStoredProcesses();
    return getStoredActiveProcessId(procs[0]?.id || INITIAL_PROCESSES[0].id);
  });
  
  const [realSubgroups, setRealSubgroups] = useState<SubgroupDataPoint[]>(() => {
    const procs = getStoredProcesses();
    const curr = procs.find(p => p.id === getStoredActiveProcessId(procs[0]?.id || INITIAL_PROCESSES[0].id)) || procs[0] || INITIAL_PROCESSES[0];
    return getStoredSubgroupsForProcess(curr);
  });

  // ================= 审查模拟模式状态 =================
  const [auditMode, setAuditMode] = useState<AuditLevelMode>('real');
  const [cnConfig, setCnConfig] = useState<CNAuditConfig>(() => getStoredCNConfig());
  const [gjbConfig, setGjbConfig] = useState<GJBAuditConfig>(() => getStoredGJBConfig());

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditModalType, setAuditModalType] = useState<'cn' | 'gjb'>('cn');

  const [enabledRules, setEnabledRules] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [activeTab, setActiveTab] = useState<'chart' | 'subgroups' | 'capability' | 'excel' | 'config'>('chart');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const currentProcess = useMemo(() => {
    return processes.find(p => p.id === activeProcessId) || processes[0];
  }, [processes, activeProcessId]);

  const handleSelectProcess = (newProcessId: string) => {
    setActiveProcessId(newProcessId);
    saveStoredActiveProcessId(newProcessId);

    const targetProc = processes.find(p => p.id === newProcessId) || processes[0];
    const stored = getStoredSubgroupsForProcess(targetProc);
    setRealSubgroups(stored);
    setEnabledRules(targetProc.activeRules || [1, 2, 3, 4, 5, 6, 7, 8]);
  };

  const handleSwitchUser = (user: UserAccount) => {
    setCurrentUser(user);
    saveStoredCurrentUser(user);
    showToast(`已切换身份为【${user.name}】（${user.role === 'admin' ? '全部管理权限' : '只读浏览权限'}）`);
  };

  const handleDataRestored = () => {
    const refreshedProcesses = getStoredProcesses();
    const refreshedActiveId = getStoredActiveProcessId(refreshedProcesses[0]?.id || INITIAL_PROCESSES[0].id);
    const curr = refreshedProcesses.find(p => p.id === refreshedActiveId) || refreshedProcesses[0];
    setProcesses(refreshedProcesses);
    setActiveProcessId(refreshedActiveId);
    setRealSubgroups(getStoredSubgroupsForProcess(curr));
    setCnConfig(getStoredCNConfig());
    setGjbConfig(getStoredGJBConfig());
  };

  // 审查模拟反推数据调度
  const activeSubgroups = useMemo(() => {
    if (auditMode === 'cn') {
      return generateAuditSimulationSubgroups(realSubgroups, currentProcess.chartType, 'cn', {
        targetCpk: cnConfig.targetCpk,
        batchCount: cnConfig.batchCount,
        sampleSize: cnConfig.sampleSize,
        usl: cnConfig.usl,
        sl: cnConfig.sl,
        lsl: cnConfig.lsl,
        ucl: cnConfig.ucl,
        cl: cnConfig.cl,
        lcl: cnConfig.lcl
      });
    }
    if (auditMode === 'gjb') {
      return generateAuditSimulationSubgroups(realSubgroups, currentProcess.chartType, 'gjb', {
        targetCpk: gjbConfig.targetCpk,
        batchCount: gjbConfig.batchCount,
        sampleSize: gjbConfig.sampleSize,
        usl: gjbConfig.usl,
        sl: gjbConfig.sl,
        lsl: gjbConfig.lsl
      });
    }
    return realSubgroups;
  }, [realSubgroups, auditMode, currentProcess.chartType, cnConfig, gjbConfig]);

  const controlLimits: ControlLimits = useMemo(() => {
    const calculated = calculateControlLimits(activeSubgroups, currentProcess.chartType);
    if (auditMode === 'cn' && cnConfig.ucl && cnConfig.cl && cnConfig.lcl) {
      return {
        ...calculated,
        ucl: cnConfig.ucl,
        cl: cnConfig.cl,
        lcl: cnConfig.lcl,
        sigma: (cnConfig.ucl - cnConfig.cl) / 3
      };
    }
    return calculated;
  }, [activeSubgroups, currentProcess.chartType, auditMode, cnConfig]);

  const evaluatedSubgroups: SubgroupDataPoint[] = useMemo(() => {
    const mainEvaluated = evaluateNelsonRules(
      activeSubgroups, 
      controlLimits, 
      enabledRules, 
      'main', 
      currentProcess.chartType
    );

    if (['xbar-r', 'xbar-s', 'i-mr'].includes(currentProcess.chartType)) {
      return evaluateNelsonRules(
        mainEvaluated, 
        controlLimits, 
        enabledRules, 
        'sub', 
        currentProcess.chartType
      );
    }
    return mainEvaluated;
  }, [activeSubgroups, controlLimits, enabledRules, currentProcess.chartType]);

  const processCapability = useMemo(() => {
    const usl = auditMode === 'cn' ? cnConfig.usl : (auditMode === 'gjb' ? gjbConfig.usl : currentProcess.usl);
    const sl = auditMode === 'cn' ? cnConfig.sl : (auditMode === 'gjb' ? gjbConfig.sl : currentProcess.sl);
    const lsl = auditMode === 'cn' ? cnConfig.lsl : (auditMode === 'gjb' ? gjbConfig.lsl : currentProcess.lsl);

    return calculateProcessCapability(
      activeSubgroups,
      controlLimits,
      usl,
      sl,
      lsl
    );
  }, [activeSubgroups, controlLimits, currentProcess, auditMode, cnConfig, gjbConfig]);

  const handleToggleRule = (ruleId: number) => {
    setEnabledRules(prev => 
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]
    );
  };

  const handleToggleAllRules = (enable: boolean) => {
    setEnabledRules(enable ? [1, 2, 3, 4, 5, 6, 7, 8] : []);
  };

  const handleVoidSubgroup = (subgroupId: string, reason?: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，仅支持浏览，无法作废数据！');
      return;
    }
    const defaultReason = reason || '异常值作废排除';
    const updated = realSubgroups.map(sg => {
      if (sg.id === subgroupId || `sim-${sg.id}` === subgroupId) {
        return {
          ...sg,
          isVoided: true,
          voidReason: defaultReason,
          voidedAt: new Date().toISOString()
        };
      }
      return sg;
    });

    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);
    showToast(`已成功作废子组，控制限已重新计算！`);
  };

  const handleRestoreSubgroup = (subgroupId: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法恢复数据！');
      return;
    }
    const updated = realSubgroups.map(sg => {
      if (sg.id === subgroupId || `sim-${sg.id}` === subgroupId) {
        const { voidReason, voidedAt, ...rest } = sg;
        return { ...rest, isVoided: false };
      }
      return sg;
    });

    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);
    showToast(`已恢复子组，控制限已同步更新！`);
  };

  const handleBatchVoid = (subgroupIds: string[], reason: string) => {
    if (!isAdmin) return;
    const updated = realSubgroups.map(sg => {
      if (subgroupIds.includes(sg.id) || subgroupIds.includes(`sim-${sg.id}`)) {
        return { ...sg, isVoided: true, voidReason: reason, voidedAt: new Date().toISOString() };
      }
      return sg;
    });
    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);
    showToast(`已批量作废 ${subgroupIds.length} 个子组！`);
  };

  const handleBatchRestore = (subgroupIds: string[]) => {
    if (!isAdmin) return;
    const updated = realSubgroups.map(sg => {
      if (subgroupIds.includes(sg.id) || subgroupIds.includes(`sim-${sg.id}`)) {
        const { voidReason, voidedAt, ...rest } = sg;
        return { ...rest, isVoided: false };
      }
      return sg;
    });
    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);
    showToast(`已批量恢复 ${subgroupIds.length} 个子组！`);
  };

  const handleImportSubgroups = (newSubgroups: SubgroupDataPoint[], mode: 'replace' | 'append' = 'replace') => {
    if (!isAdmin) return;
    let finalSubgroups: SubgroupDataPoint[] = [];

    if (mode === 'append') {
      const existingBatchSet = new Set(realSubgroups.map(s => s.batchNo.toLowerCase()));
      const toAppend = newSubgroups.filter(s => !existingBatchSet.has(s.batchNo.toLowerCase()));
      finalSubgroups = [...realSubgroups, ...toAppend].map((sg, idx) => ({ ...sg, seq: idx + 1 }));
    } else {
      finalSubgroups = newSubgroups.map((sg, idx) => ({ ...sg, seq: idx + 1 }));
    }

    setRealSubgroups(finalSubgroups);
    saveStoredSubgroupsForProcess(activeProcessId, finalSubgroups);
    setActiveTab('chart');
    showToast(`数据已成功导入并保存！`);
  };

  const handleResetDemoData = () => {
    if (!isAdmin) return;
    const demo = generateInitialSubgroups(currentProcess);
    setRealSubgroups(demo);
    saveStoredSubgroupsForProcess(activeProcessId, demo);
    showToast(`已重置为标准工业仿真数据！`);
  };

  const handleDeleteProcess = (processId: string) => {
    if (!isAdmin || processes.length <= 1) return;
    const remaining = processes.filter(p => p.id !== processId);
    if (activeProcessId === processId) {
      setActiveProcessId(remaining[0].id);
      saveStoredActiveProcessId(remaining[0].id);
      setRealSubgroups(getStoredSubgroupsForProcess(remaining[0]));
    }
    setProcesses(remaining);
    saveStoredProcesses(remaining);
  };

  const handleAddProcess = (newProc: ProcessCharacteristic) => {
    if (!isAdmin) return;
    const updated = [...processes, newProc];
    setProcesses(updated);
    saveStoredProcesses(updated);
    setActiveProcessId(newProc.id);
    saveStoredActiveProcessId(newProc.id);
    const initialData = generateInitialSubgroups(newProc);
    setRealSubgroups(initialData);
    saveStoredSubgroupsForProcess(newProc.id, initialData);
  };

  const handleUpdateProcess = (updated: ProcessCharacteristic) => {
    if (!isAdmin) return;
    const newProcesses = processes.map(p => p.id === updated.id ? updated : p);
    setProcesses(newProcesses);
    saveStoredProcesses(newProcesses);
  };

  const handleOpenAuditModal = (type: 'cn' | 'gjb') => {
    if (!isAdmin) {
      showToast('修改审查参数需管理员权限');
      return;
    }
    setAuditModalType(type);
    setIsAuditModalOpen(true);
  };

  const handleSaveCnConfig = (cfg: CNAuditConfig) => {
    setCnConfig(cfg);
    saveStoredCNConfig(cfg);
    setAuditMode('cn');
    showToast(`CN等级审查参数已生效！`);
  };

  const handleSaveGjbConfig = (cfg: GJBAuditConfig) => {
    setGjbConfig(cfg);
    saveStoredGJBConfig(cfg);
    setAuditMode('gjb');
    showToast(`国军标等级审查参数已生效！`);
  };

  const handleClickCnLevel = () => {
    if (!cnConfig.isConfigured) {
      if (!isAdmin) {
        setIsAuthModalOpen(true);
        return;
      }
      handleOpenAuditModal('cn');
    } else {
      setAuditMode('cn');
      showToast(`已切换至【CN等级】模拟图表`);
    }
  };

  const handleClickGjbLevel = () => {
    if (!gjbConfig.isConfigured) {
      if (!isAdmin) {
        setIsAuthModalOpen(true);
        return;
      }
      handleOpenAuditModal('gjb');
    } else {
      setAuditMode('gjb');
      showToast(`已切换至【国军标等级】模拟图表`);
    }
  };

  const voidedCount = evaluatedSubgroups.filter(s => s.isVoided).length;

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-200 ${
      isDark 
        ? 'bg-slate-950 text-slate-100 selection:bg-indigo-600' 
        : 'bg-slate-50 text-slate-800 selection:bg-indigo-500 selection:text-white'
    }`}>
      {/* 顶部企业级导航栏 */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 md:px-8 py-2.5 shadow-sm transition-colors ${
        isDark ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">智能 SPC 统计过程控制系统</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                  v2.6
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  《质量特性控制图查询》
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Nelson 8 大判异准则 | 本地离线持久化 | 体系审查模拟反推引擎 (CN/国军标)
              </p>
            </div>
          </div>

          {/* 右侧工具栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">工序:</span>
              <select
                value={activeProcessId}
                onChange={(e) => handleSelectProcess(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                {processes.map(proc => (
                  <option key={proc.id} value={proc.id} className={isDark ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}>
                    {proc.name} [{proc.chartType.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden lg:inline">数据备份</span>
            </button>

            {/* 身份权限按钮 */}
            {isAdmin ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-slate-950 hover:bg-indigo-100 dark:hover:bg-slate-800 border border-indigo-300 dark:border-indigo-500/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold">管理员: {currentUser.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-slate-950 hover:bg-amber-100 dark:hover:bg-slate-800 border border-amber-300 dark:border-amber-500/40 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold">访客: {currentUser.name}</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={handleResetDemoData}
                title="重置当前工序演示数据"
                className={`p-2 border rounded-xl transition-all ${
                  isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-4">
        {/* ================= ✅ 彻底修复：这个头在深浅色模式下完美自适应 ================= */}
        <div className={`p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 ${
          isDark 
            ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 text-slate-100 shadow-xl' 
            : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-indigo-400' : 'text-indigo-600'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                《质量特性控制图查询》
              </span>
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>|</span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {currentProcess.name}
              </span>
              <span className={`text-[11px] px-2 py-0.2 rounded font-mono font-bold uppercase border ${
                isDark ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {currentProcess.chartType}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              数据源: 人工 Excel 表格上传 | 聚合规则: <b>严格按生产批号聚合</b> | 当前展示模式: 
              <b className={auditMode === 'real' ? 'text-emerald-500 ml-1' : auditMode === 'cn' ? 'text-sky-500 ml-1' : 'text-amber-500 ml-1'}>
                {auditMode === 'real' ? '真实生产数据' : auditMode === 'cn' ? 'CN等级审查模拟模式' : '国军标等级审查模拟模式'}
              </b>
            </p>
          </div>

          {/* 按钮组 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 真实数据按钮 */}
            <button
              onClick={() => {
                setAuditMode('real');
                showToast(`已切回真实生产原始数据`);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                auditMode === 'real'
                  ? isDark 
                    ? 'bg-slate-800 text-slate-100 border border-slate-600 ring-2 ring-emerald-500/20' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-2 ring-emerald-500/20'
                  : isDark
                    ? 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border border-slate-800'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              真实数据
            </button>

            {/* 主题模式切换按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                  isDark 
                    ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={`当前主题：${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色主题' : '浅色主题'}`}
              >
                {themeMode === 'system' ? (
                  <Monitor className="w-4 h-4 text-indigo-500" />
                ) : themeMode === 'dark' ? (
                  <Moon className="w-4 h-4 text-sky-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </button>

              {showThemeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)}></div>
                  <div className={`absolute right-0 mt-2 w-36 rounded-xl border p-1 shadow-2xl z-50 text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <button
                      onClick={() => handleSelectTheme('system')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                        themeMode === 'system' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      跟随系统
                    </button>
                    <button
                      onClick={() => handleSelectTheme('light')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                        themeMode === 'light' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      浅色主题
                    </button>
                    <button
                      onClick={() => handleSelectTheme('dark')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                        themeMode === 'dark' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-sky-400" />
                      深色主题
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* CN等级按钮 */}
            <div className="relative inline-flex items-center">
              <button
                onClick={handleClickCnLevel}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  auditMode === 'cn'
                    ? 'bg-sky-600 text-white shadow-sky-600/30 ring-2 ring-sky-500/40'
                    : isDark 
                      ? 'bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/90' 
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200'
                }`}
              >
                <Award className="w-4 h-4 text-sky-400" />
                <span>CN等级</span>
                {cnConfig.isConfigured && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-900 text-sky-200 font-mono">
                    Cpk:{cnConfig.targetCpk}
                  </span>
                )}
              </button>
              {cnConfig.isConfigured && isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAuditModal('cn');
                  }}
                  className={`ml-1 p-1.5 rounded-lg border text-xs ${
                    isDark ? 'bg-slate-900 text-sky-300 border-sky-900' : 'bg-slate-100 text-sky-700 border-sky-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 国军标等级按钮 */}
            <div className="relative inline-flex items-center">
              <button
                onClick={handleClickGjbLevel}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  auditMode === 'gjb'
                    ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-500/40'
                    : isDark 
                      ? 'bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-800/90' 
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>国军标等级</span>
                {gjbConfig.isConfigured && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900 text-amber-200 font-mono">
                    GJB:{gjbConfig.targetCpk}
                  </span>
                )}
              </button>
              {gjbConfig.isConfigured && isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAuditModal('gjb');
                  }}
                  className={`ml-1 p-1.5 rounded-lg border text-xs ${
                    isDark ? 'bg-slate-900 text-amber-300 border-amber-900' : 'bg-slate-100 text-amber-700 border-amber-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 核心 Tab 选项卡导航 */}
        <div className={`flex items-center gap-1 border-b text-xs font-medium transition-colors ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'chart' 
                ? 'border-indigo-500 text-indigo-500 font-semibold bg-indigo-500/5' 
                : isDark 
                  ? 'border-transparent text-slate-400 hover:text-slate-200' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <LineChart className="w-4 h-4" />
            SPC 控制图与实时判异
          </button>

          <button
            onClick={() => setActiveTab('subgroups')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'subgroups' 
                ? 'border-indigo-500 text-indigo-500 font-semibold bg-indigo-500/5' 
                : isDark 
                  ? 'border-transparent text-slate-400 hover:text-slate-200' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            子组数据明细
            {voidedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-bold">
                {voidedCount}作废
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('capability')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'capability' 
                ? 'border-indigo-500 text-indigo-500 font-semibold bg-indigo-500/5' 
                : isDark 
                  ? 'border-transparent text-slate-400 hover:text-slate-200' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            过程能力分析 (CPK/PPK)
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'excel' 
                ? 'border-indigo-500 text-indigo-500 font-semibold bg-indigo-500/5' 
                : isDark 
                  ? 'border-transparent text-slate-400 hover:text-slate-200' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel 模板搭建与数据上传
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'config' 
                ? 'border-indigo-500 text-indigo-500 font-semibold bg-indigo-500/5' 
                : isDark 
                  ? 'border-transparent text-slate-400 hover:text-slate-200' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            工序特性与规则配置
          </button>
        </div>

        {/* Tab 视图挂载 */}
        {activeTab === 'chart' && (
          <div className="space-y-4">
            <SPCChart
              process={currentProcess}
              subgroups={evaluatedSubgroups}
              limits={controlLimits}
              enabledRules={enabledRules}
              onToggleRule={handleToggleRule}
              onToggleAllRules={handleToggleAllRules}
              onVoidSubgroup={handleVoidSubgroup}
              onRestoreSubgroup={handleRestoreSubgroup}
              auditMode={auditMode}
              cnConfig={cnConfig}
              gjbConfig={gjbConfig}
              onOpenAuditModal={handleOpenAuditModal}
              onSwitchAuditMode={(m) => setAuditMode(m)}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {activeTab === 'subgroups' && (
          <div className="space-y-4">
            <SubgroupDataTable
              process={currentProcess}
              subgroups={evaluatedSubgroups}
              onVoidSubgroup={handleVoidSubgroup}
              onRestoreSubgroup={handleRestoreSubgroup}
              onBatchVoid={handleBatchVoid}
              onBatchRestore={handleBatchRestore}
              auditMode={auditMode}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {activeTab === 'capability' && (
          <div className="space-y-4">
            <ProcessCapabilityView
              process={currentProcess}
              subgroups={evaluatedSubgroups}
              capability={processCapability}
            />
          </div>
        )}

        {activeTab === 'excel' && (
          <div className="space-y-4">
            <ExcelTemplateManager
              currentProcess={currentProcess}
              existingCount={realSubgroups.length}
              onUpdateProcess={handleUpdateProcess}
              onImportSubgroups={handleImportSubgroups}
              onResetDemoData={handleResetDemoData}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <ProcessConfigManager
              processes={processes}
              activeProcessId={activeProcessId}
              onSelectProcess={handleSelectProcess}
              onAddProcess={handleAddProcess}
              onUpdateProcess={handleUpdateProcess}
              onDeleteProcess={handleDeleteProcess}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </main>

      {/* 模态框组 */}
      <AccountAuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        onClose={() => setIsAuthModalOpen(false)}
        onSwitchUser={handleSwitchUser}
      />

      <DataBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={handleDataRestored}
        showToast={showToast}
      />

      <AuditParamModal
        isOpen={isAuditModalOpen}
        type={auditModalType}
        process={currentProcess}
        allProcesses={processes}
        currentLimits={controlLimits}
        initialCnConfig={cnConfig}
        initialGjbConfig={gjbConfig}
        onClose={() => setIsAuditModalOpen(false)}
        onSaveCnConfig={handleSaveCnConfig}
        onSaveGjbConfig={handleSaveGjbConfig}
        onSelectProcess={handleSelectProcess}
      />

      {/* 页脚 */}
      <footer className={`border-t py-3 text-center text-[11px] transition-colors ${
        isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
      }`}>
        智能 SPC 质量统计过程控制系统 · 《质量特性控制图查询》体系审查专项支持 · 符合 ISO 7870 &amp; GJB 军标
      </footer>
    </div>
  );
}