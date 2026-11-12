import React, { useState, useRef, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Upload,
  Printer,
  Trash2,
  Calendar,
  FileText,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  X,
  ShieldAlert,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Paperclip
} from 'lucide-react';
import { DOCUMENT_STATUS_LABELS, effectivePermissions, type DocumentStatus } from '../../shared/roles';
import { SavedReport, RiskLevel } from '../types/safety';
import { UserProfile } from '../types/auth';
import { exportReportsToCSV, exportReportsToJSON } from '../data/storage';
import { usePortalData } from '../hooks/usePortalData';
import { importDocuments } from '../services/portalApi';

interface RecordsViewProps {
  reports: SavedReport[];
  onRefreshReports: () => void;
  onPrintReport: (report: SavedReport) => void;
  onSelectReportToEdit: (report: SavedReport) => void;
  onExportPdfDirect?: (report: SavedReport) => void;
  currentUser?: UserProfile | null;
  onReviewReport?: (
    report: SavedReport,
    decision: 'semak' | 'lulus' | 'tolak',
    note: string
  ) => Promise<void> | void;
  onDeleteReport?: (id: string) => Promise<void> | void;
}

const STATUS_BADGE_CLASS: Record<DocumentStatus, string> = {
  draf: 'bg-slate-100 text-slate-700 border-slate-200',
  dihantar: 'bg-amber-50 text-amber-900 border-amber-300',
  disemak: 'bg-blue-50 text-blue-900 border-blue-300',
  diluluskan: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ditolak: 'bg-red-50 text-red-800 border-red-300'
};

function StatusBadge({ status }: { status?: DocumentStatus }) {
  if (!status) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${STATUS_BADGE_CLASS[status]}`}
    >
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

export type SortOrder = 'DATE_DESC' | 'DATE_ASC' | 'RISK_DESC' | 'RISK_ASC' | 'TITLE_ASC';
export type DateQuickFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const RecordsView: React.FC<RecordsViewProps> = ({
  reports,
  onRefreshReports,
  onPrintReport,
  onSelectReportToEdit,
  onExportPdfDirect,
  currentUser,
  onReviewReport,
  onDeleteReport
}) => {
  // 1. Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'HIRARC' | 'L2B'>('ALL');
  const [workshopFilter, setWorkshopFilter] = useState<string>('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [dateQuickFilter, setDateQuickFilter] = useState<DateQuickFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<SortOrder>('DATE_DESC');
  const [selectedReportForModal, setSelectedReportForModal] = useState<SavedReport | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const fileImportRef = useRef<HTMLInputElement>(null);

  const permissions = currentUser
    ? currentUser.permissions ?? effectivePermissions(currentUser.role, currentUser.isSystemAdmin)
    : [];
  const canReview = permissions.includes('document:review');
  const canApprove = permissions.includes('document:approve');
  const canDeleteAny = permissions.includes('document:delete:any');
  const canDeleteOwn = permissions.includes('document:delete:own');

  // Compute Risk Level Counts for quick filter pills
  const riskCounts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    reports.forEach((r) => {
      if (r.maxRiskLevel === 'High') high++;
      else if (r.maxRiskLevel === 'Medium') medium++;
      else if (r.maxRiskLevel === 'Low') low++;
    });
    return { all: reports.length, high, medium, low };
  }, [reports]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setWorkshopFilter('ALL');
    setRiskLevelFilter('ALL');
    setDateQuickFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('DATE_DESC');
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    typeFilter !== 'ALL' ||
    workshopFilter !== 'ALL' ||
    riskLevelFilter !== 'ALL' ||
    dateQuickFilter !== 'ALL' ||
    customStartDate ||
    customEndDate
  );

  // Date filtering logic
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // Filtered and Sorted Reports
  const filteredAndSorted = useMemo(() => {
    const result = reports.filter((r) => {
      // 1. Filter by Form Type
      if (typeFilter !== 'ALL' && r.jenis !== typeFilter) return false;

      // 2. Filter by Workshop
      if (workshopFilter !== 'ALL' && r.location !== workshopFilter) return false;

      // 3. Filter by Hazard Risk Level
      if (riskLevelFilter !== 'ALL') {
        if (r.jenis === 'HIRARC') {
          // Check if overall report matches or any individual hazard matches
          const matchesOverall = r.maxRiskLevel === riskLevelFilter;
          const matchesRow = r.hirarc?.rows.some((row) => {
            const score = Number(row.l) * Number(row.s);
            const level = score >= 15 ? 'High' : score >= 5 ? 'Medium' : 'Low';
            return level === riskLevelFilter;
          });
          if (!matchesOverall && !matchesRow) return false;
        } else {
          // For checklist: if High, only show if compliance < 80%
          if (riskLevelFilter === 'High' && (r.complianceRate ?? 100) >= 80) return false;
          if (riskLevelFilter === 'Medium' && ((r.complianceRate ?? 100) < 80 || (r.complianceRate ?? 100) > 95)) return false;
          if (riskLevelFilter === 'Low' && (r.complianceRate ?? 100) <= 95) return false;
        }
      }

      // 4. Filter by Date
      if (dateQuickFilter === 'TODAY' && r.date !== todayStr) return false;
      if (dateQuickFilter === 'WEEK' && r.date < oneWeekAgo) return false;
      if (dateQuickFilter === 'MONTH' && r.date < firstDayOfMonth) return false;
      if (dateQuickFilter === 'CUSTOM') {
        if (customStartDate && r.date < customStartDate) return false;
        if (customEndDate && r.date > customEndDate) return false;
      }

      // 5. Filter by Search Query (Title, ID, Workshop, Officer, Hazard description)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchTitle = (r.titleOrLocation || '').toLowerCase().includes(q);
        const matchId = (r.id || '').toLowerCase().includes(q);
        const matchLoc = (r.location || '').toLowerCase().includes(q);
        const matchPrep = (r.preparedBy || '').toLowerCase().includes(q);
        const matchSum = (r.summary || '').toLowerCase().includes(q);
        const matchDate = (r.date || '').toLowerCase().includes(q);

        // Deep search within HIRARC hazard rows
        const matchHazards = r.hirarc?.rows.some((row) =>
          (row.hazard || '').toLowerCase().includes(q) ||
          (row.workActivity || '').toLowerCase().includes(q) ||
          (row.effect || '').toLowerCase().includes(q) ||
          (row.recommendedControl || '').toLowerCase().includes(q)
        );

        if (!matchTitle && !matchId && !matchLoc && !matchPrep && !matchSum && !matchDate && !matchHazards) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'DATE_DESC') return b.date.localeCompare(a.date);
      if (sortBy === 'DATE_ASC') return a.date.localeCompare(b.date);
      if (sortBy === 'RISK_DESC') return (b.maxRiskScore || 0) - (a.maxRiskScore || 0);
      if (sortBy === 'RISK_ASC') return (a.maxRiskScore || 0) - (b.maxRiskScore || 0);
      if (sortBy === 'TITLE_ASC') return (a.titleOrLocation || '').localeCompare(b.titleOrLocation || '');
      return 0;
    });

    return result;
  }, [
    reports,
    typeFilter,
    workshopFilter,
    riskLevelFilter,
    dateQuickFilter,
    customStartDate,
    customEndDate,
    searchTerm,
    sortBy,
    todayStr,
    oneWeekAgo,
    firstDayOfMonth
  ]);

  const handleDownloadCSV = () => {
    const csvContent = exportReportsToCSV(reports);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Keselamatan_JKM_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    const jsonContent = exportReportsToJSON(reports);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Backup_Keselamatan_JKM_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          alert('Format JSON tidak sah.');
          return;
        }
        const result = await importDocuments(parsed as SavedReport[]);
        onRefreshReports();
        alert(
          `Berjaya mengimport ${result.imported} rekod ke D1.${
            result.failed.length > 0 ? ` ${result.failed.length} gagal.` : ''
          }`
        );
      } catch (error) {
        alert(
          `Ralat mengimport sandaran: ${
            error instanceof Error ? error.message : 'format tidak sah'
          }`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteReport) return;
    await onDeleteReport(id);
    if (selectedReportForModal?.id === id) setSelectedReportForModal(null);
  };

  const { workshopNames } = usePortalData();

  const handleReview = async (decision: 'semak' | 'lulus' | 'tolak') => {
    if (!selectedReportForModal || !onReviewReport) return;
    if (decision === 'tolak' && !reviewNote.trim()) {
      alert('Sila masukkan sebab penolakan dalam nota semakan.');
      return;
    }
    setIsReviewing(true);
    try {
      await onReviewReport(selectedReportForModal, decision, reviewNote.trim());
      setSelectedReportForModal(null);
      setReviewNote('');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Top Header & Backup Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Log Rekod Keselamatan Bengkel JKM</span>
              <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {reports.length} Rekod
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cari dan tapis rekod mengikut Tarikh, Tajuk / Aktiviti, atau Tahap Risiko (Low / Medium / High)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Muat turun senarai dalam format CSV / Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Eksport CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Sandaran penuh pangkalan data JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Sandaran JSON</span>
            </button>
            <label className="cursor-pointer">
              <span className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Pulih JSON</span>
              </span>
              <input
                ref={fileImportRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 2. Interactive Filter Section: Title Search, Hazard Level, Date & Workshop */}
        <div className="space-y-3">
          {/* Row 1: Search by Title/Keywords + Form Type + Workshop Location Filter + Direct Date Picker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Search Input (Title, ID, Officer, Hazard Keyword) */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari mengikut Tajuk, ID, Lokasi, Hazard atau Pegawai..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-9 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all shadow-2xs font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Padam carian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Form Type Filter */}
            <div className="md:col-span-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full border border-slate-300 rounded-xl p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700 shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua Jenis Borang</option>
                <option value="HIRARC">Hanya HIRARC (Lampiran 1)</option>
                <option value="L2B">Hanya Audit (Lampiran 2B)</option>
              </select>
            </div>

            {/* Workshop Location Filter */}
            <div className="md:col-span-3">
              <select
                value={workshopFilter}
                onChange={(e) => setWorkshopFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 font-bold shadow-2xs cursor-pointer"
              >
                <option value="ALL">ðŸ“ Semua Bengkel &amp; Makmal (11 Lokasi)</option>
                {workshopNames.map((ws, idx) => (
                  <option key={idx} value={ws}>
                    ðŸ“ {ws}
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Specific Date Selector */}
            <div className="md:col-span-2 relative flex items-center">
              <input
                type="date"
                value={dateQuickFilter === 'CUSTOM' ? customStartDate : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setDateQuickFilter('CUSTOM');
                    setCustomStartDate(e.target.value);
                    setCustomEndDate(e.target.value);
                  } else {
                    setDateQuickFilter('ALL');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-slate-700 shadow-2xs cursor-pointer"
                title="Pilih tarikh spesifik laporan"
              />
            </div>
          </div>

          {/* Row 2: Hazard Level Filter Chips + Date Filter Bar + Sort Control */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-1">
            {/* Quick Hazard Level Filter Buttons (Tinggi, Sederhana, Rendah) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>Tahap Bahaya / Risiko:</span>
              </span>

              <button
                type="button"
                onClick={() => setRiskLevelFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  riskLevelFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Semua</span>
                <span className="text-[10px] font-mono opacity-80">({riskCounts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setRiskLevelFilter('High')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                  riskLevelFilter === 'High'
                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                    : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                }`}
              >
                <span>ðŸ”´ Tinggi (High)</span>
                <span className="text-[10px] font-mono">({riskCounts.high})</span>
              </button>

              <button
                type="button"
                onClick={() => setRiskLevelFilter('Medium')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                  riskLevelFilter === 'Medium'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>ðŸŸ¡ Sederhana (Med)</span>
                <span className="text-[10px] font-mono">({riskCounts.medium})</span>
              </button>

              <button
                type="button"
                onClick={() => setRiskLevelFilter('Low')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                  riskLevelFilter === 'Low'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>ðŸŸ¢ Rendah (Low)</span>
                <span className="text-[10px] font-mono">({riskCounts.low})</span>
              </button>
            </div>

            {/* Date Quick Presets & Date Pickers */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <button
                  type="button"
                  onClick={() => setDateQuickFilter('ALL')}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    dateQuickFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Semua Tarikh
                </button>
                <button
                  type="button"
                  onClick={() => setDateQuickFilter('TODAY')}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    dateQuickFilter === 'TODAY' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setDateQuickFilter('WEEK')}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    dateQuickFilter === 'WEEK' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setDateQuickFilter('MONTH')}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    dateQuickFilter === 'MONTH' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setDateQuickFilter('CUSTOM')}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    dateQuickFilter === 'CUSTOM' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Pilih Tarikh...
                </button>
              </div>

              {/* Sort Order Selector */}
              <div className="flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOrder)}
                  className="border border-slate-300 rounded-lg py-1 px-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-slate-700"
                >
                  <option value="DATE_DESC">Tarikh Terbaharu</option>
                  <option value="DATE_ASC">Tarikh Terawal</option>
                  <option value="RISK_DESC">Risiko Tertinggi</option>
                  <option value="RISK_ASC">Risiko Terendah</option>
                  <option value="TITLE_ASC">Tajuk (A - Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 3: Custom Date Range Pickers (shown when 'CUSTOM' selected) */}
          {dateQuickFilter === 'CUSTOM' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-in fade-in-50 duration-150">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Julat Tarikh Laporan:</span>
              </span>
              <div className="flex items-center gap-2">
                <label className="text-slate-500">Dari:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="border border-slate-300 rounded-lg p-1.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500">Hingga:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="border border-slate-300 rounded-lg p-1.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold underline ml-auto"
                >
                  Padam Julat Tarikh
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Filter Result Status Banner */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>
              Menunjukkan <strong>{filteredAndSorted.length}</strong> daripada <strong>{reports.length}</strong> laporan
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Penapis Aktif
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 hover:underline"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset Semua Penapis</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Reports Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-28">Tarikh</th>
                <th className="p-3 w-28">Jenis</th>
                <th className="p-3">Tajuk / Aktiviti / Lokasi</th>
                <th className="p-3">Bengkel</th>
                <th className="p-3">Penilai</th>
                <th className="p-3 w-32 text-center">Tahap Risiko / Skor</th>
                <th className="p-3 w-28 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-slate-800 text-sm">
                        Tiada rekod laporan dijumpai
                      </div>
                      <p className="text-xs text-slate-500">
                        Tiada laporan yang sepadan dengan kriteria carian "{searchTerm || 'semasa'}" atau penapis tarikh/tahap risiko yang dipilih.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Kosongkan Penapis Carian</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((report, idx) => {
                  return (
                    <tr
                      key={report.id}
                      onClick={() => {
                        setSelectedReportForModal(report);
                        setReviewNote('');
                      }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{report.date}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                            report.jenis === 'HIRARC'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          {report.jenis === 'HIRARC' ? 'HIRARC (L1)' : 'Audit (L2B)'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="truncate max-w-xs sm:max-w-md font-medium text-slate-900">
                          {report.titleOrLocation || report.location}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>ID: {report.id}</span>
                          <StatusBadge status={report.status} />
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {report.location}
                      </td>
                      <td className="p-3 text-slate-600">
                        {report.preparedBy}
                      </td>
                      <td className="p-3 text-center">
                        {report.maxRiskLevel && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-block ${
                              report.maxRiskLevel === 'High'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : report.maxRiskLevel === 'Medium'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {report.maxRiskLevel === 'High' ? 'ðŸ”´ Tinggi' : report.maxRiskLevel === 'Medium' ? 'ðŸŸ¡ Sederhana' : 'ðŸŸ¢ Rendah'} ({report.maxRiskScore})
                          </span>
                        )}
                        {report.complianceRate !== undefined && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-block">
                            {report.complianceRate}% Patuh
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {onExportPdfDirect && (
                            <button
                              type="button"
                              onClick={() => onExportPdfDirect(report)}
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Muat Turun Fail PDF (jsPDF)"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onPrintReport(report)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Cetak Laporan"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {(!currentUser ||
                            canDeleteAny ||
                            (canDeleteOwn && (!report.ownerId || report.ownerId === currentUser.id))) && (
                            <button
                              type="button"
                              onClick={(e) => handleDelete(report.id, e)}
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Padam Rekod"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Modal with Full Hazard Breakdown & Export Options */}
      {selectedReportForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  ID: {selectedReportForModal.id}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedReportForModal.titleOrLocation}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selectedReportForModal.status} />
                  {selectedReportForModal.docNo && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {selectedReportForModal.docNo}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForModal(null)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold p-1 rounded-lg"
              >
                âœ•
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Bengkel / Lokasi:</span>
                  <strong>{selectedReportForModal.location}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Tarikh:</span>
                  <strong>{selectedReportForModal.date}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Pegawai / Penilai:</span>
                  <strong>{selectedReportForModal.preparedBy}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Jenis Borang:</span>
                  <strong>{selectedReportForModal.jenis === 'HIRARC' ? 'HIRARC (Lampiran 1)' : 'Pemeriksaan (Lampiran 2B)'}</strong>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">Ringkasan Laporan:</span>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                  {selectedReportForModal.summary}
                </p>
              </div>

              {selectedReportForModal.attachments && selectedReportForModal.attachments.length > 0 && (
                <div>
                  <span className="font-bold text-slate-800 block mb-1">
                    Lampiran R2 ({selectedReportForModal.attachments.length}):
                  </span>
                  <div className="space-y-1.5">
                    {selectedReportForModal.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate flex-1 font-medium">{attachment.fileName}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {Math.round(attachment.size / 1024)} KB
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedReportForModal.reviewNote && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                  <span className="font-bold block mb-0.5">Nota Semakan</span>
                  <p className="text-[11px] leading-relaxed">{selectedReportForModal.reviewNote}</p>
                  {selectedReportForModal.reviewedBy && (
                    <p className="text-[10px] text-amber-800 mt-1">
                      Oleh {selectedReportForModal.reviewedBy}
                      {selectedReportForModal.reviewedAt
                        ? ` Â· ${selectedReportForModal.reviewedAt.replace('T', ' ').slice(0, 16)}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              {onReviewReport &&
                currentUser &&
                selectedReportForModal.ownerId !== currentUser.id &&
                ['dihantar', 'disemak'].includes(selectedReportForModal.status ?? '') &&
                (canReview || canApprove) && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Tindakan Semakan PBAC
                      </label>
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        rows={2}
                        placeholder="Nota semakan (wajib untuk penolakan)"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canReview && (
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => handleReview('semak')}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold"
                        >
                          Tanda Disemak
                        </button>
                      )}
                      {canApprove && (
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => handleReview('lulus')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold"
                        >
                          Luluskan
                        </button>
                      )}
                      {canReview && (
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => handleReview('tolak')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold"
                        >
                          Tolak
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {selectedReportForModal.jenis === 'HIRARC' && selectedReportForModal.hirarc && (
                <div>
                  <span className="font-bold text-slate-800 block mb-2">
                    Senarai Hazard ({selectedReportForModal.hirarc.rows.length} item):
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedReportForModal.hirarc.rows.map((r, i) => {
                      const score = Number(r.l) * Number(r.s);
                      const level = score >= 15 ? 'High' : score >= 5 ? 'Medium' : 'Low';
                      return (
                        <div key={i} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
                          <div className="flex justify-between items-center">
                            <strong className="text-slate-900">#{i + 1}. {r.hazard}</strong>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                level === 'High'
                                  ? 'bg-red-100 text-red-800'
                                  : level === 'Medium'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              L:{r.l} &times; S:{r.s} = {score} ({level})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">Aktiviti: {r.workActivity}</div>
                          <div className="text-[11px] text-slate-600">Kawalan Disyorkan: {r.recommendedControl}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onSelectReportToEdit(selectedReportForModal);
                  setSelectedReportForModal(null);
                }}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-semibold"
              >
                Buka &amp; Muat Semula Borang
              </button>

              <div className="flex gap-2">
                {onExportPdfDirect && (
                  <button
                    type="button"
                    onClick={() => {
                      onExportPdfDirect(selectedReportForModal);
                      setSelectedReportForModal(null);
                    }}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Muat Turun PDF (jsPDF)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onPrintReport(selectedReportForModal);
                    setSelectedReportForModal(null);
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Paparan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportForModal(null)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


