import React, { useState } from 'react';
import {
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  CheckSquare,
  Sparkles,
  Cloud,
  Clock,
  Download,
  Users,
  Search,
  LogIn,
  UserPlus,
  BadgeCheck,
  ExternalLink,
  ChevronRight,
  GraduationCap,
  MapPin,
  Lock,
  Mail,
  SlidersHorizontal,
  Flame,
  Award
} from 'lucide-react';
import { ROLE_LABELS, roleLabel } from '../../shared/roles';
import { UserProfile } from '../types/auth';
import { usePortalData } from '../hooks/usePortalData';
import { ActiveTab } from './Header';

interface LandingPageViewProps {
  currentUser: UserProfile | null;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenMatrix: () => void;
  onOpenCloudflare: () => void;
  onStartInspection: (tab: 'HIRARC' | 'CHECKLIST', workshop: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  currentUser,
  onLoginSuccess,
  onLogout,
  onNavigateTab,
  onOpenMatrix,
  onOpenCloudflare,
  onStartInspection,
  onOpenAuth
}) => {
  const { workshopNames } = usePortalData();

  return (
    <div className="space-y-12 pb-16">
      {/* 1. HERO SECTION WITH INSTITUTIONAL BRANDING & ACCOUNT ACCESS */}
      <section className="relative overflow-hidden rounded-3xl bg-[#03231a] text-white shadow-xl border border-emerald-950 p-6 sm:p-10 lg:p-12">
        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-1/4 -mt-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Hero Copy & PKS Credentials */}
          <div className="lg:col-span-7 space-y-6">
            {/* Badges exactly like screenshot: yellow pill for PKS and dark green pill for JKM */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#f59e0b] text-[#1c1917] shadow-xs">
                <Award className="w-3.5 h-3.5" />
                POLITEKNIK KUCHING SARAWAK (PKS)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#064e3b]/80 text-[#34d399] border border-[#059669]/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
                Jabatan Kejuruteraan Mekanikal (JKM)
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight leading-[1.15] text-white">
                Portal Keselamatan<br />Bengkel &amp; Makmal JKM
              </h1>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
                Sistem pengurusan keselamatan &amp; kesihatan pekerjaan bersepadu bagi 11 bengkel dan makmal Kejuruteraan Mekanikal di Politeknik Kuching Sarawak. Berpandukan format standard <strong className="text-[#fbbf24] font-semibold">HIRARC (Lampiran 1 PK-06)</strong>, <strong className="text-[#fbbf24] font-semibold">Senarai Semak (Lampiran 2B)</strong>, Garis Panduan JKKP 2008 &amp; Akta OSHA 1994.
              </p>
            </div>

            {/* Micro Pillars formatted exactly like screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-[#063327]/60 border border-emerald-800/60 backdrop-blur-xs">
                <div className="font-bold text-[#34d399] flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>PK-06 Standard</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Format Rasmi Politeknik Malaysia
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#063327]/60 border border-emerald-800/60 backdrop-blur-xs">
                <div className="font-bold text-[#fbbf24] flex items-center gap-1.5 text-xs">
                  <Cloud className="w-4 h-4 shrink-0" />
                  <span>Cloudflare D1 (3NF)</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Pangkalan Data Edge Berperingkat
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#063327]/60 border border-emerald-800/60 backdrop-blur-xs">
                <div className="font-bold text-[#2dd4bf] flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Workers AI Llama 3.1</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Cadangan Kawalan Risiko Pintar
                </div>
              </div>
            </div>

            {/* Action Buttons: Matriks rujukan sahaja, akses sistem memerlukan pengesahan akaun */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenMatrix}
                className="px-4 py-2.5 rounded-xl bg-[#78350f]/70 hover:bg-[#78350f] text-[#fde68a] border border-[#d97706]/60 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                title="Buka Jadual Matriks Risiko 5×5 JKKP"
              >
                <span className="font-mono font-bold">5×5</span>
                <span>Matriks Risiko JKKP</span>
              </button>
            </div>
          </div>

          {/* Right Column: Account access card */}
          <div className="lg:col-span-5">
            <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200">
              {currentUser ? (
                /* Authenticated State in Card - exactly matching screenshot */
                <div className="space-y-5">
                  <div className="p-4 bg-[#e8f5e9]/50 border border-[#c8e6c9] rounded-2xl flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-[#00695c] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {currentUser.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="inline-block">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#bbf7d0] text-[#065f46] px-2 py-0.5 rounded-md">
                          SESI AKTIF
                        </span>
                      </div>
                      <div className="font-extrabold text-slate-900 text-base truncate mt-1">
                        {currentUser.name}
                      </div>
                      <div className="text-xs text-[#047857] font-mono truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-2 text-slate-600 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Peranan:</span>
                      <span className="font-bold text-slate-900">{roleLabel(currentUser.role, currentUser.isSystemAdmin)}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">No. Pekerja:</span>
                      <span className="font-mono font-bold text-slate-900">{currentUser.staffId}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Institusi:</span>
                      <span className="font-semibold text-slate-900">{currentUser.institution || 'Politeknik Kuching Sarawak'}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Bengkel Ditugaskan:</span>
                      <span className="font-bold text-slate-900">{currentUser.workshopLocation}</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('DASHBOARD')}
                      className="w-full py-3 bg-[#065f46] hover:bg-[#047857] text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Masuk ke Dashboard Sistem</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full py-1 text-slate-600 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center block"
                    >
                      Tukar Akaun / Log Keluar
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated: password account with administrator approval */
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">
                        Log Masuk Akaun JKM
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Pendaftaran terbuka · Akaun perlu kelulusan Pentadbir Sistem
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-800">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Akses terkawal
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Daftar dengan e-mel dan kata laluan. Permohonan disemak oleh Pentadbir Sistem
                      sebelum akaun diaktifkan bagi menghalang pendaftaran spam atau akses tanpa
                      kebenaran.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAuth?.('login')}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log Masuk</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenAuth?.('register')}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    <span>Daftar Akaun Baharu</span>
                  </button>

                  <div className="rounded-xl border border-slate-200 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Peranan tersedia
                    </span>
                    {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((role) => (
                      <div key={role} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{ROLE_LABELS[role]}</span>
                      </div>
                    ))}
                    <div className="text-[11px] text-slate-500 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <span>Pentadbir Sistem (diberikan oleh pentadbir sedia ada)</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                    {workshopNames.length} bengkel &amp; makmal berdaftar dalam pangkalan data D1
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>      </section>

      {/* 2. INSTITUTIONAL METRICS STRIP */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">11</div>
            <div className="text-xs text-slate-500 font-medium">Bengkel &amp; Makmal JKM</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">PK-06(1)</div>
            <div className="text-xs text-slate-500 font-medium">Format Standard KKP</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">Suku Tahun</div>
            <div className="text-xs text-slate-500 font-medium">Audit Lampiran 2B (90 Hari)</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">3NF + AI</div>
            <div className="text-xs text-slate-500 font-medium">Cloudflare D1 &amp; Workers AI</div>
          </div>
        </div>
      </section>

      {/* 3. CORE MODULES & FEATURES */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Modul Utama Sistem
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Pematuhan KKP Bersepadu Jabatan Kejuruteraan Mekanikal
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Dibangunkan khusus untuk memenuhi keperluan akreditasi EAC/ETAC dan pematuhan Akta Keselamatan &amp; Kesihatan Pekerjaan 1994 di Politeknik Kuching Sarawak.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1: HIRARC Form Multi-step */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Borang HIRARC (Lampiran 1 PK-06)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Borang multi-langkah berpandukan garis panduan JKKP 2008. Merangkumi aktiviti kerja, identifikasi hazard (fizikal, kimia, ergonomik, mekanikal), analisis risiko 5Ã—5, dan pelan tindakan kawalan.
            </p>
          </div>

          {/* Feature 2: Safety Checklist Lampiran 2B */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Senarai Semak (Lampiran 2B)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pemeriksaan berkala 7 seksyen keselamatan fizikal: Laluan Keluar &amp; Kecemasan, Alat Pemadam Api, Pendawaian Elektrik, Pengudaraan, Mesin &amp; Peralatan, Kebersihan (Housekeeping) dan Peti Kecemasan.
            </p>
          </div>

          {/* Feature 3: Workers AI Assistant */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Cloudflare Workers AI Llama 3.1</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Penjana cadangan kawalan risiko automatik berpandukan Hierarki Kawalan (Penyingkiran, Penggantian, Kawalan Kejuruteraan, Pentadbiran, dan PPE) berasaskan hazard &amp; skor risiko JKKP.
            </p>
          </div>

          {/* Feature 4: Quarterly Reminder */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Peringatan Audit Suku Tahun (90 Hari)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pemantauan automatik bagi bengkel atau makmal yang tidak mengemukakan laporan senarai semak Lampiran 2B melebihi suku tahun (90 hari) untuk tindakan segera Ketua Bengkel.
            </p>
          </div>

          {/* Feature 5: Cloudflare D1 3NF Architecture */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Pangkalan Data Terpencar (3NF)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Skema pangkalan data relasi 3NF (Bentuk Normal Ketiga) tanpa kebergantungan separa atau transitif, dengan sokongan Cloudflare D1 SQL, KV Cache dan R2 Object Storage.
            </p>
          </div>

          {/* Feature 6: PDF Export & Printable Documents */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Jana PDF Format Cetakan A4</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Eksport dokumen keselamatan dalam format PDF rasmi dengan kepala surat rasmi Jabatan Kejuruteraan Mekanikal Politeknik Kuching Sarawak dan tandatangan digital pemeriksa.
            </p>
          </div>
        </div>
      </section>

      {/* 4. INSTITUTIONAL FOOTER SECTION */}
      <section className="rounded-2xl bg-slate-900 text-slate-300 p-6 sm:p-8 space-y-6">
        <div className="space-y-2 max-w-4xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>POLITEKNIK KUCHING SARAWAK Â· JABATAN KEJURUTERAAN MEKANIKAL</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            KM 22, Jalan Matang, 93050 Kuching, Sarawak, Malaysia.
            <br />
            Portal Keselamatan &amp; Kesihatan Pekerjaan JKM menyokong matlamat Zero Accident di makmal dan bengkel latihan politeknik di bawah naungan Jabatan Pendidikan Politeknik &amp; Kolej Komuniti (JPPKK), Kementerian Pendidikan Tinggi Malaysia.
          </p>
        </div>

        <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div>
            Â© {new Date().getFullYear()} Politeknik Kuching Sarawak. Hak Cipta Terpelihara.
          </div>
          <div className="flex items-center gap-3">
            <span>Sistem KKP PK-06(1)</span>
            <span>Â·</span>
            <span>OSHA 1994 / JKKP 2008</span>
            <span>Â·</span>
            <span className="font-mono text-emerald-400">user@poliku.edu.my</span>
          </div>
        </div>
      </section>
    </div>
  );
};



