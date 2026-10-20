/**
 * 用户权限与角色定义
 */

export type UserRole = 'admin' | 'guest';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  department: string;
  avatarColor: string;
}

export const PRESET_ACCOUNTS: UserAccount[] = [
  {
    id: 'user-admin',
    username: 'admin',
    displayName: '质量主管 (管理员)',
    role: 'admin',
    department: '品质保证部 (QA/QC)',
    avatarColor: 'from-amber-500 to-indigo-600'
  },
  {
    id: 'user-guest',
    username: 'guest',
    displayName: '现场巡检员 (访客只读)',
    role: 'guest',
    department: '生产车间 / 外部审查组',
    avatarColor: 'from-slate-600 to-slate-700'
  }
];
