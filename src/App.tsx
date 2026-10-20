/**
 * 智能 SPC 统计过程控制系统 - 主应用程序
 * 严格遵照工业制造质量控制规范与用户定制需求实现
 * 包含：
 * 1. 账号权限体系（管理员全部权限 vs 访客只读点选查看权限）
 * 2. 客户端本地存储双向持久化引擎（解决 Netlify 纯静态外网部署打开默认页面、数据不保存问题）
 * 3. 体系审查专项功能（“CN等级”与“国军标等级”自动数学反推模拟）
 * 4. 增量追加/全量覆盖 Excel 导入与数据作废重算
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
  User
} from 'lucide-react';

export default function App() {
  // ================= 账号与权限控制状态 =================
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getStoredCurrentUser());
  const isAdmin = currentUser.role === 'admin';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // ================= 工序特性与数据集合 (接入本地持久化存储，保障 Netlify 外网访问) =================
  const [processes, setProcesses] = useState<ProcessCharacteristic[]>(() => getStoredProcesses());
  const [activeProcessId, setActiveProcessId] = useState<string>(() => {
    const procs = getStoredProcesses();
    return getStoredActiveProcessId(procs[0]?.id || INITIAL_PROCESSES[0].id);
  });
  
  // 真实子组原始数据集合 (优先从持久化字典加载)
  const [realSubgroups, setRealSubgroups] = useState<SubgroupDataPoint[]>(() => {
    const procs = getStoredProcesses();
    const curr = procs.find(p => p.id === getStoredActiveProcessId(procs[0]?.id || INITIAL_PROCESSES[0].id)) || procs[0] || INITIAL_PROCESSES[0];
    return getStoredSubgroupsForProcess(curr);
  });

  // ================= 审查模拟模式状态 (用于审查使用) =================
  const [auditMode, setAuditMode] = useState<AuditLevelMode>('real');

  // CN 等级参数配置持久化 (首次输入后记录，后续免重复输入)
  const [cnConfig, setCnConfig] = useState<CNAuditConfig>(() => getStoredCNConfig());

  // 国军标等级参数配置持久化 (首次输入后记录，后续免重复输入)
  const [gjbConfig, setGjbConfig] = useState<GJBAuditConfig>(() => getStoredGJBConfig());

  // 参数配置弹窗状态
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditModalType, setAuditModalType] = useState<'cn' | 'gjb'>('cn');

  // Nelson 8 大判异规则勾选状态 (默认启用当前工序预置规则)
  const [enabledRules, setEnabledRules] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);

  // 当前主导航 Tab
  const [activeTab, setActiveTab] = useState<'chart' | 'subgroups' | 'capability' | 'excel' | 'config'>('chart');

  // 全局操作反馈 Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 获取当前选中的工序对象
  const currentProcess = useMemo(() => {
    return processes.find(p => p.id === activeProcessId) || processes[0];
  }, [processes, activeProcessId]);

  // 切换工序操作 (立即从持久化存储中读取，且同步激活 ID)
  const handleSelectProcess = (newProcessId: string) => {
    setActiveProcessId(newProcessId);
    saveStoredActiveProcessId(newProcessId);

    const targetProc = processes.find(p => p.id === newProcessId) || processes[0];
    const stored = getStoredSubgroupsForProcess(targetProc);
    setRealSubgroups(stored);
    setEnabledRules(targetProc.activeRules || [1, 2, 3, 4, 5, 6, 7, 8]);

    // 若有后端服务则尝试同步
    fetch(`/api/spc/subgroups?processId=${newProcessId}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
          setRealSubgroups(res.data);
          saveStoredSubgroupsForProcess(newProcessId, res.data);
        }
      })
      .catch(() => {});
  };

  // 账号切换处理
  const handleSwitchUser = (user: UserAccount) => {
    setCurrentUser(user);
    saveStoredCurrentUser(user);
    showToast(`已切换身份为【${user.name}】（${user.role === 'admin' ? '全部管理权限' : '只读浏览权限'}）`);
  };

  // 数据备份恢复回调
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

  // ================= 核心子组数据调度 (审查模拟机制) =================
  // 要求：模拟后子组数据抓取真实数据的除测量值以外的数据（生产批次号、采集日期等）
  const activeSubgroups = useMemo(() => {
    if (auditMode === 'cn') {
      return generateAuditSimulationSubgroups(realSubgroups, currentProcess.chartType, 'cn', {
        targetCpk: cnConfig.targetCpk,
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
        usl: gjbConfig.usl,
        sl: gjbConfig.sl,
        lsl: gjbConfig.lsl
      });
    }
    return realSubgroups;
  }, [realSubgroups, auditMode, currentProcess.chartType, cnConfig, gjbConfig]);

  // 1. 核心计算：根据样本自动计算控制限 (UCL / CL / LCL)
  // 如果是 CN 审查模式且用户显式指定了控制限要求，直接优先采用用户输入的控制限
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

  // 2. 核心计算：Nelson 8 大判异准则实时评估 (根据用户勾选的 enabledRules)
  const evaluatedSubgroups: SubgroupDataPoint[] = useMemo(() => {
    const mainEvaluated = evaluateNelsonRules(activeSubgroups, controlLimits, enabledRules, 'main');
    if (['xbar-r', 'xbar-s', 'i-mr'].includes(currentProcess.chartType)) {
      return evaluateNelsonRules(mainEvaluated, controlLimits, enabledRules, 'sub');
    }
    return mainEvaluated;
  }, [activeSubgroups, controlLimits, enabledRules, currentProcess.chartType]);

  // 3. 核心计算：过程能力分析 (Cp, Cpk, Pp, Ppk)
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

  // 规则勾选切换
  const handleToggleRule = (ruleId: number) => {
    setEnabledRules(prev => 
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]
    );
  };

  const handleToggleAllRules = (enable: boolean) => {
    setEnabledRules(enable ? [1, 2, 3, 4, 5, 6, 7, 8] : []);
  };

  // 数据作废/剔除异常值 (权限拦截与持久化)
  const handleVoidSubgroup = (subgroupId: string, reason?: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，仅支持浏览，无法作废数据！请登录管理员账号。');
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

    fetch('/api/spc/subgroups/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId: activeProcessId, subgroupId, reason: defaultReason })
    }).catch(() => {});

    showToast(`已成功作废子组，控制限已自动重新计算并已保存！`);
  };

  // 恢复作废子组 (权限拦截与持久化)
  const handleRestoreSubgroup = (subgroupId: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，仅支持浏览，无法恢复数据！请登录管理员账号。');
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

    fetch('/api/spc/subgroups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId: activeProcessId, subgroupId })
    }).catch(() => {});

    showToast(`已恢复子组，控制限已同步更新并已保存！`);
  };

  // 批量作废
  const handleBatchVoid = (subgroupIds: string[], reason: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法进行批量作废操作！');
      return;
    }
    const updated = realSubgroups.map(sg => {
      if (subgroupIds.includes(sg.id) || subgroupIds.includes(`sim-${sg.id}`)) {
        return {
          ...sg,
          isVoided: true,
          voidReason: reason,
          voidedAt: new Date().toISOString()
        };
      }
      return sg;
    });

    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);

    fetch('/api/spc/subgroups/batch-void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId: activeProcessId, subgroupIds, reason })
    }).catch(() => {});

    showToast(`已批量作废 ${subgroupIds.length} 个子组，控制限已重新计算并已保存！`);
  };

  // 批量恢复
  const handleBatchRestore = (subgroupIds: string[]) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法进行批量恢复操作！');
      return;
    }
    const updated = realSubgroups.map(sg => {
      if (subgroupIds.includes(sg.id) || subgroupIds.includes(`sim-${sg.id}`)) {
        const { voidReason, voidedAt, ...rest } = sg;
        return { ...rest, isVoided: false };
      }
      return sg;
    });

    setRealSubgroups(updated);
    saveStoredSubgroupsForProcess(activeProcessId, updated);

    fetch('/api/spc/subgroups/batch-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId: activeProcessId, subgroupIds })
    }).catch(() => {});

    showToast(`已批量恢复 ${subgroupIds.length} 个子组并已保存！`);
  };

  // 导入 Excel 解析数据 (支持全量清空覆盖与增量追加合并，自动客户端持久化)
  const handleImportSubgroups = (newSubgroups: SubgroupDataPoint[], mode: 'replace' | 'append' = 'replace') => {
    if (!isAdmin) {
      showToast('当前为访客权限，仅支持浏览，无法上传或修改数据！请切换为管理员账号。');
      return;
    }

    let finalSubgroups: SubgroupDataPoint[] = [];

    if (mode === 'append') {
      // 增量追加模式：根据生产批号智能去重，并顺延序号
      const existingBatchSet = new Set(realSubgroups.map(s => s.batchNo.toLowerCase()));
      const toAppend = newSubgroups.filter(s => !existingBatchSet.has(s.batchNo.toLowerCase()));
      
      finalSubgroups = [...realSubgroups, ...toAppend].map((sg, idx) => ({
        ...sg,
        seq: idx + 1
      }));

      setRealSubgroups(finalSubgroups);
      saveStoredSubgroupsForProcess(activeProcessId, finalSubgroups);
      setActiveTab('chart');
      showToast(`增量追加成功！成功新增 ${toAppend.length} 批（已过滤同批号重复项），当前共计 ${finalSubgroups.length} 批次，已自动保存！`);
    } else {
      // 全量清空覆盖模式
      finalSubgroups = newSubgroups.map((sg, idx) => ({
        ...sg,
        seq: idx + 1
      }));

      setRealSubgroups(finalSubgroups);
      saveStoredSubgroupsForProcess(activeProcessId, finalSubgroups);
      setActiveTab('chart');
      showToast(`已清空原有历史数据，全量导入 ${finalSubgroups.length} 个新批次并重新计算控制限，已自动保存！`);
    }

    fetch('/api/spc/subgroups/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId: activeProcessId, subgroups: finalSubgroups, mode })
    }).catch(() => {});
  };

  // 重置演示数据
  const handleResetDemoData = () => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法重置数据！请登录管理员账号。');
      return;
    }
    const demo = generateInitialSubgroups(currentProcess);
    setRealSubgroups(demo);
    saveStoredSubgroupsForProcess(activeProcessId, demo);
    fetch('/api/spc/reset-demo', { method: 'POST' }).catch(() => {});
    showToast(`已重置为标准工业仿真数据并已保存！`);
  };

  // 删除工序
  const handleDeleteProcess = (processId: string) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法删除工序！请切换为管理员账号。');
      return;
    }
    if (processes.length <= 1) {
      showToast('系统至少需保留一个工序特性，无法全部删除');
      return;
    }
    const targetProcess = processes.find(p => p.id === processId);
    const targetName = targetProcess?.name || '指定工序';
    const remainingProcesses = processes.filter(p => p.id !== processId);

    // 如果删除的是当前选中的工序，自动切换至剩下的第一个工序
    if (activeProcessId === processId) {
      const nextId = remainingProcesses[0].id;
      setActiveProcessId(nextId);
      saveStoredActiveProcessId(nextId);
      setRealSubgroups(getStoredSubgroupsForProcess(remainingProcesses[0]));
    }
    setProcesses(remainingProcesses);
    saveStoredProcesses(remainingProcesses);

    fetch(`/api/spc/processes/${processId}`, { method: 'DELETE' }).catch(() => {});
    showToast(`工序【${targetName}】已成功删除并已保存`);
  };

  // 新增工序
  const handleAddProcess = (newProc: ProcessCharacteristic) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法新增工序！请切换为管理员账号。');
      return;
    }
    const updated = [...processes, newProc];
    setProcesses(updated);
    saveStoredProcesses(updated);

    setActiveProcessId(newProc.id);
    saveStoredActiveProcessId(newProc.id);

    const initialData = generateInitialSubgroups(newProc);
    setRealSubgroups(initialData);
    saveStoredSubgroupsForProcess(newProc.id, initialData);

    showToast(`已创建新工序【${newProc.name}】并已本地保存`);
  };

  // 更新工序
  const handleUpdateProcess = (updated: ProcessCharacteristic) => {
    if (!isAdmin) {
      showToast('当前为访客权限，无法修改工序！请切换为管理员账号。');
      return;
    }
    const newProcesses = processes.map(p => p.id === updated.id ? updated : p);
    setProcesses(newProcesses);
    saveStoredProcesses(newProcesses);
    showToast(`工序【${updated.name}】配置已更新并已保存`);
  };

  // ================= 处理 CN等级 与 国军标等级 按钮逻辑 =================
  const handleOpenAuditModal = (type: 'cn' | 'gjb') => {
    if (!isAdmin) {
      showToast('当前为访客权限，仅可查看模拟效果，修改审查参数需管理员权限');
      return;
    }
    setAuditModalType(type);
    setIsAuditModalOpen(true);
  };

  // 保存 CN 等级参数并切换到 CN 模拟模式
  const handleSaveCnConfig = (cfg: CNAuditConfig) => {
    setCnConfig(cfg);
    saveStoredCNConfig(cfg);
    setAuditMode('cn');
    showToast(`CN等级审查参数已保存并生成模拟数据与图表！`);
  };

  // 保存国军标等级参数并切换到国军标模拟模式
  const handleSaveGjbConfig = (cfg: GJBAuditConfig) => {
    setGjbConfig(cfg);
    saveStoredGJBConfig(cfg);
    setAuditMode('gjb');
    showToast(`国军标等级审查参数已保存，已模拟出高可靠性军标受控图表！`);
  };

  // 点击“CN等级”按钮交互：第一次输入，后续直接切换模拟数据
  const handleClickCnLevel = () => {
    if (!cnConfig.isConfigured) {
      if (!isAdmin) {
        showToast('首次配置 CN 等级审查参数需要管理员权限，请先登录管理员');
        setIsAuthModalOpen(true);
        return;
      }
      handleOpenAuditModal('cn');
    } else {
      setAuditMode('cn');
      showToast(`已一键切换至【CN等级】模拟图表（基于真实批号抓取）`);
    }
  };

  // 点击“国军标等级”按钮交互：第一次输入，后续直接切换模拟数据
  const handleClickGjbLevel = () => {
    if (!gjbConfig.isConfigured) {
      if (!isAdmin) {
        showToast('首次配置国军标等级审查参数需要管理员权限，请先登录管理员');
        setIsAuthModalOpen(true);
        return;
      }
      handleOpenAuditModal('gjb');
    } else {
      setAuditMode('gjb');
      showToast(`已一键切换至【国军标等级】模拟图表（基于真实批号抓取）`);
    }
  };

  // 状态统计
  const totalSubgroups = evaluatedSubgroups.length;
  const activeCount = evaluatedSubgroups.filter(s => !s.isVoided).length;
  const voidedCount = evaluatedSubgroups.filter(s => s.isVoided).length;
  const violationPoints = evaluatedSubgroups.filter(s => !s.isVoided && s.violations && s.violations.length > 0).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* 顶部企业级导航栏 */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-2.5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 系统 Logo & 页面标题 */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                  智能 SPC 统计过程控制系统
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  v2.6
                </span>
                <span className="text-xs text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  《质量特性控制图查询》
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Nelson 8 大判异准则 | 本地离线持久化 | 体系审查模拟反推引擎 (CN/国军标)
              </p>
            </div>
          </div>

          {/* 右侧工具栏：工序选择、数据备份、账号与权限 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 工序选择 */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">工序:</span>
              <select
                value={activeProcessId}
                onChange={(e) => handleSelectProcess(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                {processes.map(proc => (
                  <option key={proc.id} value={proc.id} className="bg-slate-900 text-slate-200">
                    {proc.name} [{proc.chartType.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {/* 数据备份与恢复按钮 */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-all shadow-sm"
              title="Netlify 自动持久化 / 备份导出与导入"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden lg:inline">数据备份</span>
            </button>

            {/* 账号身份与权限切换按钮 */}
            {isAdmin ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/40 text-xs font-semibold text-indigo-300 flex items-center gap-2 shadow-sm transition-all group"
                title="当前以管理员身份登录，拥有全部权限。点击可切换身份或查看权限"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-bold">管理员: {currentUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 hidden sm:inline">
                  全权限
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center gap-2 shadow-sm transition-all group"
                title="当前以访客身份登录（只读浏览）。点击可登录管理员账号以解锁操作权限"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">访客: {currentUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  只读
                </span>
              </button>
            )}

            {/* 重置当前工序数据 */}
            {isAdmin && (
              <button
                onClick={handleResetDemoData}
                title="重置当前工序演示数据"
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-4">
        {/* 访客只读模式顶部提示条 */}
        {!isAdmin && (
          <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-xl text-xs text-amber-200 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <b>当前处于【访客只读模式】</b>：您可点选查阅 SPC 控制图、子组数据与过程能力分析。所有修改、上传与删除功能已被安全锁定。
              </span>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs transition-all shrink-0 shadow flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              切换管理员
            </button>
          </div>
        )}

        {/* 《质量特性控制图查询》功能顶部专区：增加“CN等级”、“国军标等级”按钮 */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                《质量特性控制图查询》
              </span>
              <span className="text-xs text-slate-500">|</span>
              <span className="text-xs text-slate-300 font-semibold">{currentProcess.name}</span>
              <span className="text-[11px] px-2 py-0.2 rounded font-mono font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                {currentProcess.chartType}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              数据源: 人工 Excel 表格上传 | 聚合规则: <b>严格按生产批号聚合</b> | 当前展示模式: 
              <b className={auditMode === 'real' ? 'text-emerald-400 ml-1' : auditMode === 'cn' ? 'text-sky-400 ml-1' : 'text-amber-400 ml-1'}>
                {auditMode === 'real' ? '真实生产数据' : auditMode === 'cn' ? 'CN等级审查模拟模式' : '国军标等级审查模拟模式'}
              </b>
            </p>
          </div>

          {/* 核心需求按钮组：“CN等级”、“国军标等级”与“真实数据” */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 真实数据按钮 */}
            <button
              onClick={() => {
                setAuditMode('real');
                showToast(`已切回真实生产原始数据`);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow ${
                auditMode === 'real'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 ring-2 ring-emerald-500/20'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-400 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              真实数据
            </button>

            {/* “CN等级”按钮 */}
            <div className="relative inline-flex items-center">
              <button
                onClick={handleClickCnLevel}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md active:scale-95 ${
                  auditMode === 'cn'
                    ? 'bg-sky-600 text-white border border-sky-400 shadow-sky-600/30 ring-2 ring-sky-500/40'
                    : 'bg-sky-950/70 hover:bg-sky-900/90 text-sky-200 border border-sky-800/90'
                }`}
                title="输入CPK值要求、控制上下限要求、规范上下限，自动模拟出符合输入的模拟数据与图表，子组数据抓取真实批号/日期"
              >
                <Award className="w-4 h-4 text-sky-300" />
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
                  title="修改 CN 等级审查输入参数"
                  className="ml-1 p-1.5 bg-slate-900 hover:bg-slate-800 text-sky-300 rounded-lg border border-sky-900 text-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* “国军标等级”按钮 */}
            <div className="relative inline-flex items-center">
              <button
                onClick={handleClickGjbLevel}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md active:scale-95 ${
                  auditMode === 'gjb'
                    ? 'bg-amber-600 text-white border border-amber-400 shadow-amber-600/30 ring-2 ring-amber-500/40'
                    : 'bg-amber-950/70 hover:bg-amber-900/90 text-amber-200 border border-amber-800/90'
                }`}
                title="输入规范上下限，自动模拟出符合国军标高可靠性严苛标准的模拟数据与图表，子组数据抓取真实批号/日期"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
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
                  title="修改国军标等级审查输入参数"
                  className="ml-1 p-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg border border-amber-900 text-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 核心 Tab 选项卡导航 */}
        <div className="flex items-center gap-1 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'chart' 
                ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <LineChart className="w-4 h-4" />
            SPC 控制图与实时判异
            {auditMode !== 'real' && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                auditMode === 'cn' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {auditMode === 'cn' ? 'CN模拟图' : '军标模拟图'}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('subgroups')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'subgroups' 
                ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Table className="w-4 h-4" />
            子组数据明细
            {auditMode !== 'real' ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">
                继承真实批号
              </span>
            ) : voidedCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                {voidedCount}作废
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('capability')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'capability' 
                ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            过程能力分析 (CPK/PPK)
            {processCapability.cpk && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold font-mono">
                Cpk:{processCapability.cpk}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'excel' 
                ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel 模板搭建与数据上传
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === 'config' 
                ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sliders className="w-4 h-4" />
            工序特性与规则配置
          </button>
        </div>

        {/* Tab 1: SPC 控制图与判异准则 */}
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

        {/* Tab 2: 子组数据 Tab 表格 */}
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

        {/* Tab 3: 过程能力分析 (CPK/PPK) */}
        {activeTab === 'capability' && (
          <div className="space-y-4">
            <ProcessCapabilityView
              process={currentProcess}
              subgroups={evaluatedSubgroups}
              capability={processCapability}
            />
          </div>
        )}

        {/* Tab 4: Excel 模板搭建与数据上传 */}
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

        {/* Tab 5: 工序特性与规则管理 */}
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

      {/* 账号与角色权限切换模态框 */}
      <AccountAuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        onClose={() => setIsAuthModalOpen(false)}
        onSwitchUser={handleSwitchUser}
      />

      {/* 数据备份与恢复模态框 */}
      <DataBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={handleDataRestored}
        showToast={showToast}
      />

      {/* 审查参数配置模态框 */}
      <AuditParamModal
        isOpen={isAuditModalOpen}
        type={auditModalType}
        process={currentProcess}
        currentLimits={controlLimits}
        initialCnConfig={cnConfig}
        initialGjbConfig={gjbConfig}
        onClose={() => setIsAuditModalOpen(false)}
        onSaveCnConfig={handleSaveCnConfig}
        onSaveGjbConfig={handleSaveGjbConfig}
      />

      {/* 全局操作 Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/80 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 页脚 */}
      <footer className="border-t border-slate-900 py-3 text-center text-[11px] text-slate-600">
        智能 SPC 质量统计过程控制系统 · 《质量特性控制图查询》体系审查专项支持 · 符合 ISO 7870 &amp; GJB 军标
      </footer>
    </div>
  );
}
