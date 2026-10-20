/**
 * 本地持久化与离线存储管理服务
 * 专为 Netlify 等纯前端静态部署环境设计，确保外网访问时数据 100% 自动保存，不因刷新或关闭页面而丢失
 */

import { 
  ProcessCharacteristic, 
  SubgroupDataPoint, 
  UserAccount, 
  CNAuditConfig, 
  GJBAuditConfig,
  SPCSystemBackup
} from '../types/spc';
import { INITIAL_PROCESSES, generateInitialSubgroups } from '../data/mockData';

const STORAGE_KEYS = {
  PROCESSES: 'spc_storage_processes_v2',
  SUBGROUPS_MAP: 'spc_storage_subgroups_map_v2',
  ACTIVE_PROCESS_ID: 'spc_storage_active_proc_id_v2',
  CURRENT_USER: 'spc_storage_current_user_v2',
  CN_CONFIG: 'spc_cn_config',
  GJB_CONFIG: 'spc_gjb_config'
};

export const PRESET_USERS: Record<string, UserAccount> = {
  admin: {
    id: 'user-admin-01',
    username: 'admin',
    name: '系统管理员',
    role: 'admin',
    title: 'SPC 质量管理主管',
    description: '拥有全部权限：新建/删除工序、导入/追加数据、作废异常点与审查配置'
  },
  guest: {
    id: 'user-guest-01',
    username: 'guest',
    name: '访客观察员',
    role: 'guest',
    title: '外部审计 / 浏览人员',
    description: '仅只读权限：支持点选查看控制图、子组数据与能力分析，不可更改任何内容'
  }
};

/**
 * 获取持久化的工序特性列表
 */
export function getStoredProcesses(): ProcessCharacteristic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROCESSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[SPC Storage] Failed to load processes from localStorage:', e);
  }
  return INITIAL_PROCESSES;
}

/**
 * 保存工序特性列表到本地存储
 */
export function saveStoredProcesses(processes: ProcessCharacteristic[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(processes));
  } catch (e) {
    console.error('[SPC Storage] Failed to save processes:', e);
  }
}

/**
 * 获取各工序子组数据字典映射
 */
export function getStoredSubgroupsMap(): Record<string, SubgroupDataPoint[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBGROUPS_MAP);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[SPC Storage] Failed to load subgroups map from localStorage:', e);
  }
  return {};
}

/**
 * 获取指定工序的子组数据 (若未曾录入则生成初始仿真数据并保存)
 */
export function getStoredSubgroupsForProcess(process: ProcessCharacteristic): SubgroupDataPoint[] {
  const map = getStoredSubgroupsMap();
  if (map[process.id] && Array.isArray(map[process.id]) && map[process.id].length > 0) {
    return map[process.id];
  }

  // 首次访问该工序时，初始化生成并自动持久化
  const initial = generateInitialSubgroups(process);
  map[process.id] = initial;
  try {
    localStorage.setItem(STORAGE_KEYS.SUBGROUPS_MAP, JSON.stringify(map));
  } catch (e) {
    console.error('[SPC Storage] Failed to auto-persist initial subgroups:', e);
  }
  return initial;
}

/**
 * 保存指定工序的子组数据
 */
export function saveStoredSubgroupsForProcess(processId: string, subgroups: SubgroupDataPoint[]): void {
  try {
    const map = getStoredSubgroupsMap();
    map[processId] = subgroups;
    localStorage.setItem(STORAGE_KEYS.SUBGROUPS_MAP, JSON.stringify(map));
  } catch (e) {
    console.error('[SPC Storage] Failed to save subgroups for process:', processId, e);
  }
}

/**
 * 获取保存的激活工序 ID
 */
export function getStoredActiveProcessId(fallbackId: string): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROCESS_ID);
    if (saved) return saved;
  } catch (e) {}
  return fallbackId;
}

/**
 * 保存当前激活的工序 ID
 */
export function saveStoredActiveProcessId(processId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROCESS_ID, processId);
  } catch (e) {}
}

/**
 * 获取当前登录用户 (默认管理员)
 */
export function getStoredCurrentUser(): UserAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role) {
        return parsed;
      }
    }
  } catch (e) {}
  return PRESET_USERS.admin;
}

/**
 * 保存当前登录用户
 */
export function saveStoredCurrentUser(user: UserAccount): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } catch (e) {}
}

/**
 * 获取 CN 等级配置
 */
export function getStoredCNConfig(): CNAuditConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CN_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    targetCpk: 1.33,
    ucl: 25.018,
    cl: 25.000,
    lcl: 24.982,
    usl: 25.025,
    sl: 25.000,
    lsl: 24.975,
    isConfigured: false
  };
}

/**
 * 保存 CN 等级配置
 */
export function saveStoredCNConfig(cfg: CNAuditConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CN_CONFIG, JSON.stringify(cfg));
  } catch (e) {}
}

/**
 * 获取国军标等级配置
 */
export function getStoredGJBConfig(): GJBAuditConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GJB_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    targetCpk: 1.67,
    usl: 25.025,
    sl: 25.000,
    lsl: 24.975,
    isConfigured: false
  };
}

/**
 * 保存国军标等级配置
 */
export function saveStoredGJBConfig(cfg: GJBAuditConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GJB_CONFIG, JSON.stringify(cfg));
  } catch (e) {}
}

/**
 * 导出全系统完整备份数据 (JSON 文件下载)
 */
export function exportSystemBackup(): string {
  const processes = getStoredProcesses();
  const subgroupsMap = getStoredSubgroupsMap();
  const activeProcessId = getStoredActiveProcessId(processes[0]?.id || 'proc-xbar-r');
  const cnConfig = getStoredCNConfig();
  const gjbConfig = getStoredGJBConfig();

  const backupData: SPCSystemBackup = {
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    processes,
    subgroupsMap,
    activeProcessId,
    cnConfig,
    gjbConfig
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * 导入系统备份数据并恢复
 */
export function importSystemBackup(jsonString: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonString) as SPCSystemBackup;
    if (!parsed || !Array.isArray(parsed.processes) || parsed.processes.length === 0) {
      return { success: false, message: '备份文件格式不正确，缺少有效的工序数据' };
    }

    localStorage.setItem(STORAGE_KEYS.PROCESSES, JSON.stringify(parsed.processes));
    if (parsed.subgroupsMap) {
      localStorage.setItem(STORAGE_KEYS.SUBGROUPS_MAP, JSON.stringify(parsed.subgroupsMap));
    }
    if (parsed.activeProcessId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROCESS_ID, parsed.activeProcessId);
    }
    if (parsed.cnConfig) {
      localStorage.setItem(STORAGE_KEYS.CN_CONFIG, JSON.stringify(parsed.cnConfig));
    }
    if (parsed.gjbConfig) {
      localStorage.setItem(STORAGE_KEYS.GJB_CONFIG, JSON.stringify(parsed.gjbConfig));
    }

    return { success: true, message: `成功恢复 ${parsed.processes.length} 个工序及对应的所有历史批次数据！` };
  } catch (e: any) {
    return { success: false, message: `解析备份文件失败: ${e.message || '未知错误'}` };
  }
}

/**
 * 清除本地自定义存储，重置回出厂默认数据
 */
export function resetToFactoryDefaults(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PROCESSES);
    localStorage.removeItem(STORAGE_KEYS.SUBGROUPS_MAP);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROCESS_ID);
    localStorage.removeItem(STORAGE_KEYS.CN_CONFIG);
    localStorage.removeItem(STORAGE_KEYS.GJB_CONFIG);
  } catch (e) {}
}
