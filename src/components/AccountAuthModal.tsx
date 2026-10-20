/**
 * 账号与角色权限管理模态框
 * 支持“系统管理员 (全部权限)”与“访客观察员 (只读权限)”登录与一键身份切换
 */

import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types/spc';
import { PRESET_USERS } from '../utils/storageService';
import { 
  ShieldCheck, 
  Eye, 
  Key, 
  User, 
  CheckCircle2, 
  X, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Check, 
  Minus,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface AccountAuthModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  onClose: () => void;
  onSwitchUser: (user: UserAccount) => void;
}

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSwitchUser,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const user = usernameInput.trim().toLowerCase();
    if (user === 'admin') {
      if (passwordInput === 'admin123' || passwordInput === 'admin') {
        onSwitchUser(PRESET_USERS.admin);
        onClose();
      } else {
        setErrorMessage('管理员密码错误（默认密码: admin123）');
      }
    } else if (user === 'guest' || user === '访客') {
      onSwitchUser(PRESET_USERS.guest);
      onClose();
    } else {
      setErrorMessage('未找到该账号，请输入 admin 或 guest');
    }
  };

  const handleQuickSwitch = (role: UserRole) => {
    const targetUser = PRESET_USERS[role];
    onSwitchUser(targetUser);
    onClose();
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
              isAdmin ? 'bg-gradient-to-tr from-indigo-600 to-sky-500 shadow-indigo-600/30' : 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-600/30'
            }`}>
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">账号与权限管理</h3>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  isAdmin 
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' 
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  当前登录: {currentUser.name} ({currentUser.role === 'admin' ? '管理权限' : '访客权限'})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                支持不同权限角色登录与快速切换，安全受控管理 SPC 数据与配置
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* 一键快捷身份切换区域 (推荐快捷方式) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                快捷角色一键切换
              </span>
              <span className="text-[11px] text-slate-500">点击卡片即可直接切换登录身份</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 管理员卡片 */}
              <div 
                onClick={() => handleQuickSwitch('admin')}
                className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                  isAdmin 
                    ? 'bg-indigo-950/40 border-indigo-500/70 shadow-lg shadow-indigo-950/50 ring-2 ring-indigo-500/20' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-indigo-600/60 hover:bg-slate-900'
                }`}
              >
                {isAdmin && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-indigo-600 text-[10px] font-bold text-white rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 当前使用中
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">系统管理员</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">admin</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      拥有系统全部操作权限：新建/删除工序、导入与追加数据、作废异常点重算控制限、审查参数配置等。
                    </p>
                    <div className="pt-2 flex items-center gap-1 text-[11px] text-indigo-400 font-semibold">
                      <span>{isAdmin ? '正在以管理员权限运行' : '点击立即切换为管理员'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 访客观察员卡片 */}
              <div 
                onClick={() => handleQuickSwitch('guest')}
                className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                  !isAdmin 
                    ? 'bg-amber-950/40 border-amber-500/70 shadow-lg shadow-amber-950/50 ring-2 ring-amber-500/20' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-600/60 hover:bg-slate-900'
                }`}
              >
                {!isAdmin && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-600 text-[10px] font-bold text-white rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 当前使用中
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">访客观察员</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">guest</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      只读浏览权限：只能点选查看各控制图、子组数据及过程能力，禁止任何修改与上传操作。
                    </p>
                    <div className="pt-2 flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                      <span>{!isAdmin ? '正在以访客模式运行' : '点击立即切换为访客'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 权限差异详细对比表 */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              管理权限 vs 访客权限 对照表
            </span>

            <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">系统功能操作模块</th>
                    <th className="py-2.5 px-3 text-center text-indigo-400 w-28">管理员权限</th>
                    <th className="py-2.5 px-3 text-center text-amber-400 w-28">访客权限</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 px-4">点选查看 SPC 控制图、均值/极差/标差曲线、判异详情</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">切换工序特性、查看各工序控制图与直方图/过程能力</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">子组数据明细查询、生产批号/设备号检索与展开测量值</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">下载标准 Excel 数据采集模板</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                  </tr>
                  <tr className="bg-slate-950/40">
                    <td className="py-2.5 px-4 text-slate-200 font-medium">数据作废/剔除异常值并重新计算控制限 (单点及批量)</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold"><Minus className="w-4 h-4 mx-auto" /> (禁止修改)</td>
                  </tr>
                  <tr className="bg-slate-950/40">
                    <td className="py-2.5 px-4 text-slate-200 font-medium">Excel 数据文件批量上传 (清空覆盖导入 / 增量追加导入)</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold"><Minus className="w-4 h-4 mx-auto" /> (禁止上传)</td>
                  </tr>
                  <tr className="bg-slate-950/40">
                    <td className="py-2.5 px-4 text-slate-200 font-medium">新增工序特性、删除现有工序、配置工程公差 (USL/SL/LSL)</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold"><Minus className="w-4 h-4 mx-auto" /> (禁止更改)</td>
                  </tr>
                  <tr className="bg-slate-950/40">
                    <td className="py-2.5 px-4 text-slate-200 font-medium">配置 CN 等级 / 国军标等级审查模拟参数</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold"><Check className="w-4 h-4 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold"><Minus className="w-4 h-4 mx-auto" /> (仅可查看)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 账号密码登录表单 (传统表单输入) */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              账号密码直接登录
            </span>

            <form onSubmit={handleLoginSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">账号名称</label>
                <input
                  type="text"
                  placeholder="admin 或 guest"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">登录密码 (访客免密)</label>
                <input
                  type="password"
                  placeholder="admin 默认密码 admin123"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  登录验证
                </button>
              </div>
            </form>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            提示：登录状态已在本地浏览器安全记住，刷新页面依然保持当前权限。
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
