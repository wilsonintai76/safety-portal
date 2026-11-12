import React from 'react';
import {
  ShieldCheck,
  BarChart3,
  FileText,
  CheckSquare,
  History,
  User,
  LogIn,
  Sparkles,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { roleShortLabel } from '../../shared/roles';
import { UserProfile } from '../types/auth';
import { ActiveTab } from './Header';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: UserProfile | null;
  onOpenMatrix?: () => void;
  onOpenCloudflare?: () => void;
  onOpenAiSettings?: () => void;
  onOpenUserManagement?: () => void;
  onOpenWorkshopManagement?: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  onOpenMatrix,
  onOpenCloudflare,
  onOpenAiSettings,
  onOpenUserManagement,
  onOpenWorkshopManagement,
  onOpenProfile,
  onOpenAuth
}) => {
  const canManageWorkshops = Boolean(
    currentUser?.isSystemAdmin || currentUser?.permissions?.includes('master:manage')
  );

  const primaryNavItems = [
    { id: 'DASHBOARD' as ActiveTab, label: 'Dashboard', icon: BarChart3, desc: 'Ringkasan & Statistik' },
    { id: 'HIRARC' as ActiveTab, label: 'HIRARC', icon: FileText, desc: 'Penilaian Risiko (PK-06)' },
    { id: 'CHECKLIST' as ActiveTab, label: 'Checklist', icon: CheckSquare, desc: 'Pemeriksaan Bengkel (L2B)' },
    { id: 'RECORDS' as ActiveTab, label: 'Log Rekod', icon: History, desc: 'Arkib & Status Semakan' }
  ];

  return (
    <aside
      aria-label="Navigasi Utama Desktop"
      className={`no-print hidden lg:flex flex-col bg-white border-r border-slate-200 sticky top-0 h-screen z-30 transition-all duration-200 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 1. Header / Brand */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('DASHBOARD')}
          className="flex items-center gap-3 text-left group overflow-hidden focus:outline-none"
          title="Ke Dashboard Utama Portal Keselamatan JKM"
        >
          <div className="w-10 h-10 rounded-xl shrink-0 bg-linear-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 truncate">
                  Portal Keselamatan
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded shrink-0">
                  PKS
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block">
                JKM · Format PK-06(1)
              </span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          title={isCollapsed ? 'Kembangkan Sidebar' : 'Kuncupkan Sidebar'}
          aria-label={isCollapsed ? 'Kembangkan Sidebar' : 'Kuncupkan Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Scrollable Body: Navigation & Quick Tools */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Navigation Section */}
        <div>
          {!isCollapsed && (
            <div className="px-2 mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Modul Utama
            </div>
          )}
          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  title={item.label}
                  className={`w-full flex items-center rounded-xl transition-all text-left ${
                    isCollapsed
                      ? 'justify-center p-3'
                      : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-emerald-700 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight truncate">
                        {item.label}
                      </div>
                      <div
                        className={`text-[10px] truncate leading-tight ${
                          isActive ? 'text-emerald-100 font-normal' : 'text-slate-400'
                        }`}
                      >
                        {item.desc}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pentadbiran & Tetapan (Hanya jika pengguna ada akses pengurusan PBAC atau tetapan AI) */}
        {((currentUser?.permissions?.includes('user:manage') && onOpenUserManagement) ||
          (canManageWorkshops && onOpenWorkshopManagement) ||
          (currentUser && onOpenAiSettings)) && (
          <div>
            {!isCollapsed && (
              <div className="px-2 mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Pengurusan &amp; Tetapan
              </div>
            )}
            <div className="space-y-1">
              {/* User Management (PBAC) - Admin only */}
              {currentUser?.permissions?.includes('user:manage') && onOpenUserManagement && (
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  title="Urus Pengguna & Penugasan Peranan PBAC"
                  className={`w-full flex items-center rounded-xl transition-all text-left ${
                    isCollapsed
                      ? 'justify-center p-3 text-slate-600 hover:bg-slate-100'
                      : 'gap-3 px-3 py-2 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0 text-emerald-700" />
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight">Urus Pengguna</div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">Kawalan PBAC</div>
                    </div>
                  )}
                </button>
              )}

              {/* Facility / Location Management (Bengkel · Makmal · Bilik) - Pentadbir Sistem only */}
              {canManageWorkshops && onOpenWorkshopManagement && (
                <button
                  type="button"
                  onClick={onOpenWorkshopManagement}
                  title="Cipta & Urus Bengkel, Makmal dan Bilik"
                  className={`w-full flex items-center rounded-xl transition-all text-left ${
                    isCollapsed
                      ? 'justify-center p-3 text-slate-600 hover:bg-slate-100'
                      : 'gap-3 px-3 py-2 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight">Urus Fasiliti</div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">
                        Bengkel · Makmal · Bilik
                      </div>
                    </div>
                  )}
                </button>
              )}

              {/* AI Settings */}
              {currentUser && onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  title="Tetapan Penyedia AI: Workers AI atau BYOK"
                  className={`w-full flex items-center rounded-xl transition-all text-left ${
                    isCollapsed
                      ? 'justify-center p-3 text-slate-600 hover:bg-slate-100'
                      : 'gap-3 px-3 py-2 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-emerald-700" />
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight">Tetapan AI</div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">Workers AI / BYOK</div>
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer / User Profile Area */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
        {currentUser ? (
          <button
            type="button"
            onClick={onOpenProfile}
            title={`${currentUser.name} (${roleShortLabel(currentUser.role, currentUser.isSystemAdmin)}) - Klik untuk Profil`}
            className={`w-full flex items-center rounded-xl transition-all text-left hover:bg-slate-200/70 p-2 ${
              isCollapsed ? 'justify-center' : 'gap-2.5'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] font-medium text-emerald-800 truncate">
                  {roleShortLabel(currentUser.role, currentUser.isSystemAdmin)}
                </div>
              </div>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            title="Log Masuk ke Akaun"
            className={`w-full flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-colors shadow-2xs ${
              isCollapsed ? 'p-2.5' : 'gap-2 py-2 px-3 text-xs'
            }`}
          >
            <LogIn className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Log Masuk</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
