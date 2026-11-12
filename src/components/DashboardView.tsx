import React, { useState, useMemo } from 'react';
import { roleLabel, roleShortLabel } from '../../shared/roles';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CheckSquare,
  Printer,
  ChevronRight,
  TrendingUp,
  Building2,
  Calendar,
  ExternalLink,
  Download,
  PieChart as PieChartIcon,
  BarChart3,
  Cloud,
  User,
  Loader2,
  BellRing,
  Clock,
  ArrowRight,
  History
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { SavedReport } from '../types/safety';
import { usePortalData } from '../hooks/usePortalData';
import { UserProfile } from '../types/auth';
import { SafetyTip, SafetyTipLibrary } from '../data/safetyTips';
import { SafetyTipCard } from './SafetyTipCard';
import { ActivityFeed } from './ActivityFeed';

interface DashboardViewProps {
  reports: SavedReport[];
  onNavigateTab: (tab: 'HIRARC' | 'CHECKLIST' | 'RECORDS') => void;
  onOpenMatrix: () => void;
  onPrintReport: (report: SavedReport) => void;
  onPrintBlank: (mode: 'HIRARC' | 'L2B') => void;
  onExportPdfDirect?: (report: SavedReport) => void;
  currentUser?: UserProfile | null;
  onOpenProfile?: () => void;
  onOpenAuth?: () => void;
  onOpenCloudflare?: () => void;
  onStartInspection?: (tab: 'HIRARC' | 'CHECKLIST', workshop: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  onNavigateTab,
  onOpenMatrix,
  onPrintReport,
  onPrintBlank,
  onExportPdfDirect,
  currentUser,
  onOpenProfile,
  onOpenAuth,
  onOpenCloudflare,
  onStartInspection
}) => {
  const { workshopNames } = usePortalData();
  const [chartView, setChartView] = useState<'pie' | 'bar'>('pie');
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);

  // Safety Tip of the Day State (Rotates randomly every visit or click)
  const [currentSafetyTip, setCurrentSafetyTip] = useState<SafetyTip>(() =>
    SafetyTipLibrary.getRandomTip()
  );

  const handleRotateSafetyTip = () => {
    setCurrentSafetyTip(SafetyTipLibrary.getRandomTip());
  };

  // Aggregate Metrics
  const totalReports = reports.length;
  const hirarcReports = reports.filter((r) => r.jenis === 'HIRARC');
  const checklistReports = reports.filter((r) => r.jenis === 'L2B');

  let totalHazards = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  // Workshop breakdown dictionary
  const workshopBreakdown: Record<string, { workshop: string; low: number; medium: number; high: number }> = {};
  workshopNames.forEach((ws) => {
    workshopBreakdown[ws] = {
      workshop: ws.replace('BENGKEL ', '').replace('MAKMAL ', ''),
      low: 0,
      medium: 0,
      high: 0
    };
  });

  hirarcReports.forEach((r) => {
    const wsKey = workshopNames.find((w) => w.toLowerCase() === (r.location || '').toLowerCase()) || r.location;
    if (!workshopBreakdown[wsKey]) {
      workshopBreakdown[wsKey] = {
        workshop: wsKey.slice(0, 16),
        low: 0,
        medium: 0,
        high: 0
      };
    }

    if (r.hirarc?.rows) {
      r.hirarc.rows.forEach((row) => {
        totalHazards++;
        const score = Number(row.l) * Number(row.s);
        if (score >= 15) {
          highRiskCount++;
          workshopBreakdown[wsKey].high++;
        } else if (score >= 5) {
          mediumRiskCount++;
          workshopBreakdown[wsKey].medium++;
        } else {
          lowRiskCount++;
          workshopBreakdown[wsKey].low++;
        }
      });
    }
  });

  // Recharts Data Sets
  const pieData = [
    { name: 'Rendah (Low 1â€“4)', value: lowRiskCount, color: '#10b981' },
    { name: 'Sederhana (Medium 5â€“12)', value: mediumRiskCount, color: '#f59e0b' },
    { name: 'Tinggi (High 15â€“25)', value: highRiskCount, color: '#ef4444' }
  ];

  const barData = Object.values(workshopBreakdown).filter(
    (item) => item.low > 0 || item.medium > 0 || item.high > 0
  );


  // 30-Day Inspection Reminder Calculation per Workshop
  const workshopReminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return workshopNames.map((ws) => {
      const wsReports = reports.filter(
        (r) => (r.location || '').trim().toLowerCase() === ws.trim().toLowerCase()
      );

      if (wsReports.length === 0) {
        return {
          workshop: ws,
          hasReport: false,
          latestReportDate: null,
          daysSinceLastReport: null,
          latestReportType: null,
          latestReportOfficer: null,
          isOverdue: true
        };
      }

      const sorted = [...wsReports].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const reportDate = new Date(latest.date);
      reportDate.setHours(0, 0, 0, 0);

      const diffTime = Math.max(0, today.getTime() - reportDate.getTime());
      const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        workshop: ws,
        hasReport: true,
        latestReportDate: latest.date,
        daysSinceLastReport: daysSince,
        latestReportType: latest.jenis,
        latestReportOfficer: latest.preparedBy,
        isOverdue: daysSince > 90 // Quarterly (Suku Tahun) inspection cycle
      };
    });
  }, [reports, workshopNames]);

  const overdueWorkshops = useMemo(() => {
    return workshopReminders.filter((w) => w.isOverdue);
  }, [workshopReminders]);

  const compliantWorkshops = useMemo(() => {
    return workshopReminders.filter((w) => !w.isOverdue);
  }, [workshopReminders]);

  // Chronological timeline of last 5 inspections for currently logged-in user
  const userTimelineReports = useMemo(() => {
    if (!currentUser) return reports.slice(0, 5);
    const cleanName = (currentUser.name || '').trim().toLowerCase();
    const matched = reports.filter((r) => {
      const p = (r.preparedBy || '').trim().toLowerCase();
      return p.includes(cleanName) || cleanName.includes(p);
    });
    const sourceList = matched.length > 0 ? matched : reports;
    return [...sourceList]
      .sort((a, b) => (b.timestamp || b.date).localeCompare(a.timestamp || a.date))
      .slice(0, 5);
  }, [reports, currentUser]);

  const avgCompliance =
    checklistReports.length > 0
      ? Math.round(
          checklistReports.reduce((acc, curr) => acc + (curr.complianceRate || 100), 0) /
            checklistReports.length
        )
      : 96;

  const handleExportPdfClick = async (report: SavedReport) => {
    if (onExportPdfDirect) {
      setExportingReportId(report.id);
      try {
        await onExportPdfDirect(report);
      } finally {
        setExportingReportId(null);
      }
    } else {
      onPrintReport(report);
    }
  };

  return (
    <div className="space-y-6">
      {/* Personalized Welcome Banner */}
      <div className="bg-linear-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-md">
              PK-06(1)(01-07-22)
            </span>
            <span className="text-xs text-emerald-200">
              Jabatan Kejuruteraan Mekanikal (JKM)
            </span>
            {currentUser && (
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-white/15 text-white rounded-md border border-white/20 flex items-center gap-1">
                <User className="w-3 h-3 text-emerald-300" />
                <span>{currentUser.name} ({roleShortLabel(currentUser.role, currentUser.isSystemAdmin)})</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {currentUser ? `Selamat Bertugas, ${currentUser.name.split(' ')[0]}` : 'Sistem Pengurusan Keselamatan Bengkel'}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
            {currentUser
              ? `Anda log masuk sebagai ${roleLabel(currentUser.role, currentUser.isSystemAdmin)} di ${currentUser.workshopLocation || 'Jabatan JKM'}. Borang HIRARC dan Senarai Semak akan diprapasang dengan kelayakan PBAC anda secara automatik.`
              : 'Pantau pengenalpastian hazard, analisis risiko 5Ã—5 (DOSH/JKKP 2008), tindakan kawalan pencegahan dan audit pemeriksaan keselamatan di seluruh 11 fasiliti bengkel JKM.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('HIRARC')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bina Borang HIRARC</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('CHECKLIST')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 backdrop-blur-xs"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Pemeriksaan Bengkel (L2B)</span>
            </button>
            <button
              type="button"
              onClick={onOpenMatrix}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>Matriks 5Ã—5 JKKP</span>
            </button>
            {currentUser && onOpenCloudflare && (
              <button
                type="button"
                onClick={onOpenCloudflare}
                className="px-4 py-2 bg-slate-900/40 hover:bg-slate-900/60 text-emerald-300 border border-emerald-400/30 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloudflare D1/KV/R2</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative corner shape */}
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
          <ShieldAlert className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Safety Tip of the Day Card (Hardcoded OSH / OSHA 1994 Library) */}
      <SafetyTipCard
        currentTip={currentSafetyTip}
        onRotateTip={handleRotateSafetyTip}
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Jumlah Laporan
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {totalReports}
          </div>
          <div className="text-[11px] text-slate-500">
            {hirarcReports.length} HIRARC Â· {checklistReports.length} Audit L2B
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Hazard Tahap Tinggi</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-red-600">
            {highRiskCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Skor 15â€“25 (Tindakan Segera)
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Hazard Sederhana & Rendah</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {mediumRiskCount + lowRiskCount}
          </div>
          <div className="text-[11px] text-slate-500">
            {mediumRiskCount} Medium Â· {lowRiskCount} Low
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Purata Pematuhan</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-700">
            {avgCompliance}%
          </div>
          <div className="text-[11px] text-slate-500">
            Berdasarkan senarai semak bengkel
          </div>
        </div>
      </div>

      {/* ================= WORKSHOP PENDING INSPECTIONS REMINDER SECTION (> 30 DAYS) ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Reminder Card Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              overdueWorkshops.length > 0
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600 text-white'
            }`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Peringatan Pemeriksaan Suku Tahun Bengkel (Lampiran 2B &gt; 90 Hari)
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  overdueWorkshops.length > 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-mono'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  {overdueWorkshops.length > 0 ? `${overdueWorkshops.length} Bengkel Tertunggak` : 'Semua Bengkel Patuh'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard PK-06(1) JKM mewajibkan setiap bengkel menjalani senarai semak pemeriksaan keselamatan Lampiran 2B sekurang-kurangnya sekali setiap suku tahun (Quarterly / 90 Hari).
              </p>
            </div>
          </div>

          {overdueWorkshops.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onStartInspection) {
                  onStartInspection('CHECKLIST', overdueWorkshops[0].workshop);
                } else {
                  onNavigateTab('CHECKLIST');
                }
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap shrink-0"
              title={`Mulakan audit bagi ${overdueWorkshops[0].workshop}`}
            >
              <span>Audit Segera Bengkel Tertunggak</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Reminder Content Body */}
        <div className="p-4 sm:p-5">
          {overdueWorkshops.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-900">
                  Status Pemeriksaan Optimum: Tiada Bengkel Tertunggak
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Kesemua 11 bengkel dan makmal JKM telah selesai menghantar sekurang-kurangnya satu laporan pemeriksaan Lampiran 2B dalam tempoh suku tahun (90 hari) kebelakangan ini.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overdueWorkshops.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/80 transition-colors flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <span className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                          {item.workshop}
                        </span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 shrink-0 whitespace-nowrap">
                          {item.hasReport ? `> ${item.daysSinceLastReport} Hari` : 'Tiada Laporan'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {item.hasReport
                              ? `Audit terakhir: ${item.latestReportDate} (${item.latestReportType})`
                              : 'Belum pernah diaudit'}
                          </span>
                        </div>
                        {item.latestReportOfficer && (
                          <div className="text-[10px] text-slate-400 truncate">
                            Oleh: {item.latestReportOfficer}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct Action Buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (onStartInspection) {
                            onStartInspection('HIRARC', item.workshop);
                          } else {
                            onNavigateTab('HIRARC');
                          }
                        }}
                        className="px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-[10px] font-bold text-center transition-colors shadow-2xs"
                        title={`Bina borang HIRARC untuk ${item.workshop}`}
                      >
                        + Bina HIRARC
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onStartInspection) {
                            onStartInspection('CHECKLIST', item.workshop);
                          } else {
                            onNavigateTab('CHECKLIST');
                          }
                        }}
                        className="px-2 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold text-center transition-colors shadow-2xs"
                        title={`Jalankan senarai semak Lampiran 2B untuk ${item.workshop}`}
                      >
                        + Audit L2B
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Collapsible View for Compliant Workshops */}
              {compliantWorkshops.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <details className="text-xs text-slate-600">
                    <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 select-none">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Lihat {compliantWorkshops.length} bengkel yang telah patuh &amp; diaudit dalam suku tahun ini (90 hari)</span>
                    </summary>
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      {compliantWorkshops.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] p-2 bg-white rounded-lg border border-slate-100">
                          <span className="font-medium text-slate-800 truncate pr-2">{c.workshop}</span>
                          <span className="text-[10px] font-bold text-emerald-700 shrink-0 font-mono">
                            {c.daysSinceLastReport} hari lalu
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= RECHARTS VISUALIZATION SECTION ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Visualisasi Analisis Tahap Risiko JKM (Recharts)
              </h3>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                {totalHazards} Hazard Dinilai
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Taburan tahap risiko mengikut matriks DOSH/JKKP 2008 merentas semua laporan HIRARC yang disimpan
            </p>
          </div>

          {/* Toggle between Pie and Bar chart */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartView('pie')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                chartView === 'pie'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Taburan Keseluruhan</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('bar')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                chartView === 'bar'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Mengikut Bengkel</span>
            </button>
          </div>
        </div>

        {/* Chart Viewports */}
        {totalHazards === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
            Belum ada rekod hazard untuk divisualisasikan. Bina laporan HIRARC baharu untuk memaparkan carta.
          </div>
        ) : chartView === 'pie' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Recharts Pie / Donut Viewport */}
            <div className="md:col-span-2 h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [`${val} hazard`, name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      borderRadius: '10px',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Side Metric Breakdown */}
            <div className="space-y-2.5 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4 text-xs">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <strong className="text-emerald-900 block font-bold">Rendah (Low 1â€“4)</strong>
                  <span className="text-[10px] text-emerald-700">Risiko boleh diterima</span>
                </div>
                <span className="font-mono font-extrabold text-sm text-emerald-800">
                  {lowRiskCount} ({totalHazards > 0 ? Math.round((lowRiskCount / totalHazards) * 100) : 0}%)
                </span>
              </div>

              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <strong className="text-amber-900 block font-bold">Sederhana (Medium 5â€“12)</strong>
                  <span className="text-[10px] text-amber-700">Tindakan terancang</span>
                </div>
                <span className="font-mono font-extrabold text-sm text-amber-800">
                  {mediumRiskCount} ({totalHazards > 0 ? Math.round((mediumRiskCount / totalHazards) * 100) : 0}%)
                </span>
              </div>

              <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between">
                <div>
                  <strong className="text-red-900 block font-bold">Tinggi (High 15â€“25)</strong>
                  <span className="text-[10px] text-red-700">Tindakan segera wajib</span>
                </div>
                <span className="font-mono font-extrabold text-sm text-red-800">
                  {highRiskCount} ({totalHazards > 0 ? Math.round((highRiskCount / totalHazards) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Recharts Bar Chart Viewport */
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="workshop"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '11px',
                    border: 'none'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="low" name="Low (Rendah)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="medium" name="Medium (Sederhana)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="high" name="High (Tinggi)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ================= RECENT USER ACTIVITY FEED & ACTION LOG ================= */}
      <ActivityFeed
        reports={reports}
        currentUser={currentUser}
        onExportPdfDirect={onExportPdfDirect}
        onPrintReport={onPrintReport}
        onNavigateTab={onNavigateTab}
      />

      {/* 2-Column Section: Status Bengkel & Laporan Terkini */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Workshop Coverage & Quick Blank Prints */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>Liputan Bengkel JKM</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {workshopNames.length} Fasiliti
              </span>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {workshopNames.map((ws, idx) => {
                const wsReports = reports.filter(
                  (r) => (r.location || '').toLowerCase() === ws.toLowerCase()
                );
                return (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-800 truncate pr-2">
                      {ws}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        wsReports.length > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {wsReports.length > 0 ? `${wsReports.length} rekod` : 'Belum diaudit'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Print Templates Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Cetak Templat Borang Kosong</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Sedia dicetak untuk kegunaan pengauditan fizikal di bengkel dan makmal.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onPrintBlank('HIRARC')}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span>Lampiran 1</span>
                <span className="text-[10px] text-slate-500">HIRARC Landscape</span>
              </button>
              <button
                type="button"
                onClick={() => onPrintBlank('L2B')}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span>Lampiran 2B</span>
                <span className="text-[10px] text-slate-500">Pemeriksaan Portrait</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Reports & Activities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Rekod Laporan Keselamatan Terkini
                </h3>
                <p className="text-[11px] text-slate-500">
                  Laporan HIRARC dan pemeriksaan yang sedia dieksport ke PDF atau dicetak
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('RECORDS')}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1"
              >
                <span>Lihat Semua Rekod</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {reports.slice(0, 5).map((rep) => (
                <div
                  key={rep.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rep.jenis === 'HIRARC'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {rep.jenis === 'HIRARC' ? 'HIRARC (L1)' : 'Pemeriksaan (L2B)'}
                      </span>
                      <strong className="text-slate-900 text-xs">
                        {rep.titleOrLocation || rep.location}
                      </strong>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{rep.location}</span>
                      <span>Â·</span>
                      <span>Oleh: {rep.preparedBy}</span>
                      <span>Â·</span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{rep.date}</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 italic">
                      {rep.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rep.maxRiskLevel && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          rep.maxRiskLevel === 'High'
                            ? 'bg-red-100 text-red-800'
                            : rep.maxRiskLevel === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {rep.maxRiskLevel} ({rep.maxRiskScore})
                      </span>
                    )}

                    {rep.complianceRate !== undefined && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {rep.complianceRate}% Patuh
                      </span>
                    )}

                    {/* PDF Export Button (jsPDF + html2canvas) */}
                    <button
                      type="button"
                      onClick={() => handleExportPdfClick(rep)}
                      disabled={exportingReportId === rep.id}
                      className="px-2.5 py-1.5 text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 font-semibold text-[11px]"
                      title="Eksport ke fail PDF (jsPDF + html2canvas)"
                    >
                      {exportingReportId === rep.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>PDF</span>
                    </button>

                    {/* Print Preview Button */}
                    <button
                      type="button"
                      onClick={() => onPrintReport(rep)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Cetak Paparan"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
