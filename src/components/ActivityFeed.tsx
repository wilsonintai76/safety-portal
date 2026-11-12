import React, { useState, useMemo } from 'react';
import {
  Activity,
  FileText,
  CheckSquare,
  Clock,
  User,
  Building,
  Download,
  Printer,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { SavedReport } from '../types/safety';
import { UserProfile } from '../types/auth';

interface ActivityFeedProps {
  reports: SavedReport[];
  currentUser?: UserProfile | null;
  onExportPdfDirect?: (report: SavedReport) => void;
  onPrintReport: (report: SavedReport) => void;
  onNavigateTab: (tab: 'HIRARC' | 'CHECKLIST' | 'RECORDS') => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  reports,
  currentUser,
  onExportPdfDirect,
  onPrintReport,
  onNavigateTab
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'HIRARC' | 'L2B' | 'MINE'>('ALL');
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Sort reports by most recent timestamp or date
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) =>
      (b.timestamp || b.date).localeCompare(a.timestamp || a.date)
    );
  }, [reports]);

  // Filter reports based on selected tab
  const filteredActivities = useMemo(() => {
    if (filterType === 'HIRARC') {
      return sortedReports.filter((r) => r.jenis === 'HIRARC');
    }
    if (filterType === 'L2B') {
      return sortedReports.filter((r) => r.jenis === 'L2B');
    }
    if (filterType === 'MINE' && currentUser) {
      const uName = currentUser.name.trim().toLowerCase();
      return sortedReports.filter((r) => {
        const prep = (r.preparedBy || '').trim().toLowerCase();
        return prep.includes(uName) || uName.includes(prep);
      });
    }
    return sortedReports;
  }, [sortedReports, filterType, currentUser]);

  const handleExportPdf = async (report: SavedReport) => {
    if (onExportPdfDirect) {
      setExportingId(report.id);
      try {
        await onExportPdfDirect(report);
      } finally {
        setExportingId(null);
      }
    } else {
      onPrintReport(report);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
      {/* Header section with icon, title, badge, and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Feed Aktiviti &amp; Log Tindakan Terkini
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-mono">
                {filteredActivities.length} Aktiviti
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kronologi tindakan penghantaran borang HIRARC (Lampiran 1 PK-06) dan Senarai Semak (Lampiran 2B) oleh warga JKM PKS
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('HIRARC')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'HIRARC'
                ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            HIRARC ({reports.filter((r) => r.jenis === 'HIRARC').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('L2B')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'L2B'
                ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Senarai Semak ({reports.filter((r) => r.jenis === 'L2B').length})
          </button>
          {currentUser && (
            <button
              type="button"
              onClick={() => setFilterType('MINE')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filterType === 'MINE'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktiviti Saya
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline List */}
      {filteredActivities.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <Activity className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">Tiada log aktiviti ditemui</h4>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {filterType === 'MINE'
              ? 'Anda belum menghantar sebarang laporan HIRARC atau pemeriksaan keselamatan lagi.'
              : 'Belum ada sebarang tindakan penghantaran borang direkodkan dalam sistem.'}
          </p>
        </div>
      ) : (
        <div className="relative space-y-4 before:absolute before:left-5 sm:before:left-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredActivities.map((act) => {
            const isHirarc = act.jenis === 'HIRARC';
            const isMyActivity = currentUser && (act.preparedBy || '').toLowerCase().includes(currentUser.name.toLowerCase());

            return (
              <div key={act.id} className="relative pl-11 sm:pl-14 group">
                {/* Timeline Node Icon */}
                <div
                  className={`absolute left-1.5 sm:left-2 top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-xs z-10 transition-transform group-hover:scale-110 ${
                    isHirarc
                      ? 'bg-linear-to-br from-emerald-600 to-teal-700'
                      : 'bg-linear-to-br from-teal-600 to-cyan-700'
                  }`}
                >
                  {isHirarc ? (
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </div>

                {/* Activity Card Container */}
                <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-300 transition-all space-y-2.5">
                  {/* Row 1: Action Header & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isHirarc
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-teal-100 text-teal-950 border border-teal-300'
                        }`}
                      >
                        {isHirarc ? 'PENGHANTARAN HIRARC (PK-06)' : 'AUDIT SENARAI SEMAK (L2B)'}
                      </span>

                      {isMyActivity && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Aktiviti Anda
                        </span>
                      )}

                      <span className="text-xs font-bold text-slate-900">
                        {act.titleOrLocation}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{act.timestamp || act.date}</span>
                    </div>
                  </div>

                  {/* Row 2: Action Description & Summary */}
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    <strong className="font-bold text-slate-900">{act.preparedBy}</strong> telah menghantar laporan{' '}
                    <strong className="text-emerald-900 font-bold">{isHirarc ? 'Penilaian Risiko HIRARC' : 'Audit Pemeriksaan Lampiran 2B'}</strong> bagi lokasi <strong className="text-slate-900 font-semibold">{act.location}</strong>.
                  </p>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-xs text-slate-600 font-medium italic">
                    "{act.summary}"
                  </div>

                  {/* Row 3: Metadata Pills & Quick Actions */}
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{act.location}</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{act.preparedBy}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {act.maxRiskLevel && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            act.maxRiskLevel === 'High'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : act.maxRiskLevel === 'Medium'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          Skor Risiko: {act.maxRiskScore} ({act.maxRiskLevel})
                        </span>
                      )}

                      {act.complianceRate !== undefined && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Pematuhan: {act.complianceRate}%
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportPdf(act)}
                        disabled={exportingId === act.id}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Eksport PDF Laporan Ini"
                      >
                        {exportingId === act.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPrintReport(act)}
                        className="p-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Cetak Paparan Dokumen"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Navigation Link */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium text-[11px]">
          Log tindakan disandarkan secara automatik ke Pangkalan Data Edge Cloudflare D1 (3NF).
        </span>
        <button
          type="button"
          onClick={() => onNavigateTab('RECORDS')}
          className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Lihat Semua Rekod di Log Rekod</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
