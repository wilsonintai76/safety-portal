import React from 'react';
import {
  ShieldCheck,
  BarChart3,
  FileText,
  CheckSquare,
  History,
  Cloud,
  User,
  LogIn,
  Sparkles,
  Users,
  Building2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { roleShortLabel } from '../../shared/roles';
import { UserProfile } from '../types/auth';

export type ActiveTab = 'LANDING' | 'DASHBOARD' | 'HIRARC' | 'CHECKLIST' | 'RECORDS';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenMatrix: () => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenCloudflare?: () => void;
  onOpenAiSettings?: () => void;
  onOpenUserManagement?: () => void;
  onOpenWorkshopManagement?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenMatrix,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onOpenCloudflare,
  onOpenAiSettings,
  onOpenUserManagement,
  onOpenWorkshopManagement,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const canManageWorkshops = Boolean(
    currentUser?.isSystemAdmin || currentUser?.permissions?.includes('master:manage')
  );

  const navItems = [
    { id: 'DASHBOARD' as ActiveTab, label: 'Dashboard', icon: BarChart3 },
    { id: 'HIRARC' as ActiveTab, label: 'HIRARC', icon: FileText },
    { id: 'CHECKLIST' as ActiveTab, label: 'Checklist', icon: CheckSquare },
    { id: 'RECORDS' as ActiveTab, label: 'Log Rekod', icon: History }
  ];

  const pageMeta: Record<ActiveTab, { title: string; subtitle: string }> = {
    LANDING: {
      title: 'Portal Keselamatan JKM',
      subtitle: 'Politeknik Kuching Sarawak · Format PK-06(1)'
    },
    DASHBOARD: {
      title: 'Dashboard Keselamatan',
      subtitle: 'Statistik, Analisis & Status Pemantauan Bengkel'
    },
    HIRARC: {
      title: 'Penilaian Risiko HIRARC',
      subtitle: 'Pengenalpastian Hazard, Penilaian & Kawalan Risiko (PK-06)'
    },
    CHECKLIST: {
      title: 'Senarai Semak Pemeriksaan',
      subtitle: 'Audit & Pemeriksaan Berkala Bengkel/Makmal (Lampiran 2B)'
    },
    RECORDS: {
      title: 'Log Rekod & Arkib Dokumen',
      subtitle: 'Senarai Laporan, Kelulusan & Lampiran Storan Cloudflare R2'
    }
  };

  const currentMeta = pageMeta[activeTab];

  return (
    <>
      {/* Top Header Bar */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left section:
              - When on LANDING or on Mobile: show Brand Logo & Title.
              - When on Desktop (with sidebar active): show Sidebar toggle & Page Context. */}
          <div className="flex items-center gap-3 min-w-0">
            {activeTab !== 'LANDING' && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="hidden lg:flex p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                title={isSidebarCollapsed ? 'Kembangkan Sidebar' : 'Kuncupkan Sidebar'}
                aria-label="Togol Sidebar"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-slate-700" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-slate-700" />
                )}
              </button>
            )}

            {/* Brand Logo: Always shown on Landing or Mobile/Tablet */}
            <div
              className={`flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer group ${
                activeTab !== 'LANDING' ? 'lg:hidden' : ''
              }`}
              onClick={() => onTabChange(currentUser ? 'DASHBOARD' : 'LANDING')}
              title={currentUser ? 'Ke Dashboard Portal Keselamatan JKM' : 'Ke Laman Utama Portal Keselamatan JKM'}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-tight">
                    Portal Keselamatan JKM
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    PKS
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:block">
                  Politeknik Kuching Sarawak · PK-06(1)
                </span>
              </div>
            </div>

            {/* Desktop Page Context (When Sidebar is active on internal views) */}
            {activeTab !== 'LANDING' && (
              <div className="hidden lg:block min-w-0">
                <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
                  {currentMeta.title}
                </h1>
                <p className="text-[11px] text-slate-500 leading-tight truncate">
                  {currentMeta.subtitle}
                </p>
              </div>
            )}
          </div>

          {/* Right section: Quick Tools & Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick 5x5 Matrix JKKP button */}
            <button
              type="button"
              onClick={onOpenMatrix}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Buka Jadual Matriks Risiko 5x5 JKKP"
            >
              <span className="tabular-nums font-mono font-bold text-amber-800">5×5</span>
              <span className="hidden sm:inline">Matriks JKKP</span>
            </button>

            {/* Cloudflare D1 / AI Quick Pill (Dipaparkan hanya selepas log masuk) */}
            {currentUser && onOpenCloudflare && (
              <button
                type="button"
                onClick={onOpenCloudflare}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Pangkalan Data Cloudflare D1 (3NF), KV, R2 & Workers AI"
              >
                <Cloud className="w-3.5 h-3.5 fill-white shrink-0" />
                <span className="hidden sm:inline">Cloudflare D1 &amp; AI</span>
                <span className="sm:hidden">D1 &amp; AI</span>
              </button>
            )}

            {/* User Auth Section: Di desktop tersembunyi jika sidebar aktif, kekal pada mobile/tablet & landing */}
            {currentUser ? (
              <button
                type="button"
                onClick={onOpenProfile}
                className={`${
                  activeTab !== 'LANDING' ? 'lg:hidden' : ''
                } p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-2 text-left cursor-pointer`}
                title="Lihat Profil Pengguna & Log Keluar"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {currentUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="hidden sm:block">
                  <div className="text-[11px] font-bold text-slate-800 max-w-30 truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium max-w-30 truncate">
                    {roleShortLabel(currentUser.role, currentUser.isSystemAdmin)}
                  </div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-2.5 sm:px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Masuk</span>
              </button>
            )}
          </div>
        </div>

        {/* Note: Redundant top horizontal mobile sub-nav strip has been completely removed to prevent double menu */}
      </header>

      {/* FIXED MOBILE & TABLET BOTTOM NAVIGATION MENU (Only for internal views, hidden on Desktop lg:) */}
      {activeTab !== 'LANDING' && (
        <nav
          aria-label="Navigasi Mudah Alih"
          className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all relative ${
                  isActive
                    ? 'text-emerald-800 font-bold bg-emerald-50/90'
                    : 'text-slate-500 hover:text-slate-800 active:scale-95'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-emerald-700" />
                )}
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'scale-110 text-emerald-700' : ''
                  }`}
                />
                <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Facility management shortcut for Pentadbir Sistem (desktop uses the sidebar) */}
          {canManageWorkshops && onOpenWorkshopManagement && (
            <button
              type="button"
              onClick={onOpenWorkshopManagement}
              title="Cipta & Urus Bengkel, Makmal dan Bilik"
              className="flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">
                Fasiliti
              </span>
            </button>
          )}
        </nav>
      )}
    </>
  );
};
