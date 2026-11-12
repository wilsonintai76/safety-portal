import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  HelpCircle,
  Printer,
  Send,
  AlertCircle,
  FileCheck,
  ListTree,
  Table as TableIcon,
  Download,
  Loader2,
  Bot,
  Settings2
} from 'lucide-react';
import { HirarcData, HirarcRow, RoutineType, ActionStatus, UploadedFile } from '../types/safety';
import { suggestControls } from '../services/portalApi';
import { AI_PROVIDER_CATALOG, type AiSuggestionResultDTO } from '../../shared/ai';
import {
  TITLE_SUGGESTIONS,
  LIKELIHOOD_DEF,
  SEVERITY_DEF,
  getRiskLevel
} from '../data/presets';
import { usePortalData } from '../hooks/usePortalData';
import { FileUploadSection } from './FileUploadSection';
import { HirarcForm } from './HirarcForm';

interface MultiStepHirarcFormProps {
  data: HirarcData;
  onChange: (updated: HirarcData) => void;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onOpenMatrix: () => void;
  onPrint: (isBlank: boolean) => void;
  onExportPdf?: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  lastAutoSaveTime?: string | null;
  onResetDraft?: () => void;
  onOpenAiSettings?: () => void;
}

export const MultiStepHirarcForm: React.FC<MultiStepHirarcFormProps> = ({
  data,
  onChange,
  files,
  onFilesChange,
  onOpenMatrix,
  onPrint,
  onExportPdf,
  onSubmit,
  isSubmitting = false,
  lastAutoSaveTime,
  onResetDraft,
  onOpenAiSettings
}) => {
  const { workshopNames } = usePortalData();
  // Step state: 1 to 5
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'step' | 'full'>('step');

  // AI State (Workers AI by default, BYOK via Tetapan AI)
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

  const describeAiSource = (result: AiSuggestionResultDTO) => {
    const label =
      AI_PROVIDER_CATALOG.find((provider) => provider.id === result.provider)?.label ?? result.provider;
    const source =
      result.source === 'local_dosh_ai_engine' ? 'Enjin Kawalan DOSH/JKKP (fallback)' : label;
    return `${source} Â· ${result.model}`;
  };

  const handleAiSuggestControl = async (rowIdx: number) => {
    const targetRow = data.rows[rowIdx];
    if (!targetRow) return;

    if (!targetRow.hazard && !targetRow.workActivity) {
      setAiNotice({
        type: 'error',
        message: 'Sila lengkapkan Aktiviti Kerja atau Hazard dahulu sebelum menjana kawalan AI.'
      });
      setTimeout(() => setAiNotice(null), 3500);
      return;
    }

    setIsAiSuggesting(true);
    setAiNotice({
      type: 'info',
      message: 'AI sedang menganalisis risiko (LÃ—S) dan menjana hierarki kawalan...'
    });

    try {
      const res = await suggestControls({
        workActivity: targetRow.workActivity,
        hazard: targetRow.hazard,
        effect: targetRow.effect,
        existingControl: targetRow.existingControl,
        likelihood: Number(targetRow.l) || 2,
        severity: Number(targetRow.s) || 2,
        workshop: data.location
      });

      if (res.success && res.suggestion) {
        const updatedRows = [...data.rows];
        updatedRows[rowIdx] = {
          ...updatedRows[rowIdx],
          recommendedControl: res.suggestion,
          status: 'Dalam Tindakan'
        };
        onChange({ ...data, rows: updatedRows });
        setAiNotice({
          type: 'success',
          message: `âœ¨ Cadangan kawalan dijana oleh ${describeAiSource(res)}${
            res.cached ? ' (cache)' : ''
          }.${res.warning ? ` Amaran: ${res.warning}` : ''}`
        });
        setTimeout(() => setAiNotice(null), 6000);
      } else {
        setAiNotice({
          type: 'error',
          message: 'Gagal menjana cadangan kawalan.'
        });
        setTimeout(() => setAiNotice(null), 4000);
      }
    } catch (e: unknown) {
      setAiNotice({
        type: 'error',
        message: `Ralat: ${e instanceof Error ? e.message : String(e)}`
      });
      setTimeout(() => setAiNotice(null), 5000);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const handleBulkAiSuggestAll = async () => {
    setIsAiSuggesting(true);
    setAiNotice({
      type: 'info',
      message: 'AI sedang memproses semua baris hazard...'
    });

    try {
      const updatedRows = [...data.rows];
      let processed = 0;
      for (let i = 0; i < updatedRows.length; i++) {
        const r = updatedRows[i];
        if (r.hazard || r.workActivity) {
          const res = await suggestControls({
            workActivity: r.workActivity,
            hazard: r.hazard,
            effect: r.effect,
            existingControl: r.existingControl,
            likelihood: Number(r.l) || 2,
            severity: Number(r.s) || 2,
            workshop: data.location
          });
          if (res.success && res.suggestion) {
            updatedRows[i] = {
              ...updatedRows[i],
              recommendedControl: res.suggestion,
              status: 'Dalam Tindakan'
            };
            processed += 1;
          }
        }
      }
      onChange({ ...data, rows: updatedRows });
      setAiNotice({
        type: 'success',
        message: `âœ¨ ${processed} baris hazard telah dilengkapi cadangan kawalan AI.`
      });
      setTimeout(() => setAiNotice(null), 5000);
    } catch (e: unknown) {
      setAiNotice({
        type: 'error',
        message: `Ralat: ${e instanceof Error ? e.message : String(e)}`
      });
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Maklumat Asas' },
    { num: 2, label: 'Hazard & Aktiviti' },
    { num: 3, label: 'Analisis Risiko' },
    { num: 4, label: 'Langkah Kawalan' },
    { num: 5, label: 'Semakan & Cetak' }
  ];

  // Helper updates
  const handleMetaChange = (field: keyof Omit<HirarcData, 'rows'>, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleRowChange = (field: keyof HirarcRow, value: any) => {
    const updatedRows = [...data.rows];
    updatedRows[activeRowIdx] = {
      ...updatedRows[activeRowIdx],
      [field]: value
    };
    onChange({ ...data, rows: updatedRows });
  };

  const handleAddRow = () => {
    const newRow: HirarcRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      rnr: 'R',
      workActivity: '',
      hazard: '',
      effect: '',
      existingControl: 'â€¢ Kawalan pentadbiran dan SOP\nâ€¢ Pemakaian PPE',
      l: 2,
      s: 1,
      recommendedControl: 'Kawalan sedia ada telah mencukupi',
      pic: data.preparedBy || 'Wilson',
      dueDate: '',
      status: 'Selesai'
    };
    onChange({
      ...data,
      rows: [...data.rows, newRow]
    });
    setActiveRowIdx(data.rows.length);
  };

  const handleDeleteRow = (index: number) => {
    if (data.rows.length <= 1) {
      alert('Borang HIRARC memerlukan sekurang-kurangnya satu baris hazard.');
      return;
    }
    const updatedRows = data.rows.filter((_, idx) => idx !== index);
    onChange({ ...data, rows: updatedRows });
    if (activeRowIdx >= updatedRows.length) {
      setActiveRowIdx(Math.max(0, updatedRows.length - 1));
    }
  };

  const handleDuplicateRow = (index: number) => {
    const target = data.rows[index];
    const duplicated: HirarcRow = {
      ...target,
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
    const updated = [...data.rows];
    updated.splice(index + 1, 0, duplicated);
    onChange({ ...data, rows: updated });
    setActiveRowIdx(index + 1);
  };

  const activeRow = data.rows[activeRowIdx] || data.rows[0];
  const activeScore = activeRow ? Number(activeRow.l) * Number(activeRow.s) : 0;
  const activeRisk = getRiskLevel(activeScore);

  // If user switched to full all-in-one view mode
  if (viewMode === 'full') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Mod Paparan:</span>
            <span className="text-xs text-slate-500">Mod Jadual Penuh (Semua Baris)</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('step')}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5 transition-colors"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Tukar ke Mod Berperingkat (Multi-Step)</span>
          </button>
        </div>

        <HirarcForm data={data} onChange={onChange} onOpenMatrix={onOpenMatrix} />

        {/* Evidence & Action Buttons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <FileUploadSection files={files} onFilesChange={onFilesChange} />

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {onExportPdf && (
                <button
                  type="button"
                  onClick={onExportPdf}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Simpan Fail PDF (jsPDF)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onPrint(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / PDF (Borang Ini)</span>
              </button>
              <button
                type="button"
                onClick={() => onPrint(true)}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <span>ðŸ“„ Borang Kosong</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Menghantar Laporan...' : 'Hantar Laporan HIRARC'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step Navigator Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 mb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Borang HIRARC Berperingkat (Multi-Step Form)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Lampiran 1 PK-06
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aliran terpandu: Maklumat Bengkel &rarr; Hazard &rarr; Analisis Risiko &rarr; Kawalan &rarr; Cetakan
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-Save (30s) Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-700 font-semibold" title="Form state automatically persisted to localStorage every 30 seconds">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span>Auto-Save (30s): {lastAutoSaveTime ? `Disimpan ${lastAutoSaveTime}` : 'Aktif'}</span>
            </div>

            {onResetDraft && (
              <button
                type="button"
                onClick={onResetDraft}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors"
                title="Selesaikan draf semasa dan mulakan borang baharu"
              >
                Reset Draf
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewMode('full')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              title="Tukar ke mod senarai panjang"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Mod Jadual Penuh</span>
            </button>
          </div>
        </div>

        {/* 5-Step Progress Indicators */}
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {steps.map((st) => {
            const isCompleted = currentStep > st.num;
            const isCurrent = currentStep === st.num;

            return (
              <button
                key={st.num}
                type="button"
                onClick={() => setCurrentStep(st.num)}
                className={`py-2 px-1 sm:px-3 rounded-xl border text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  isCurrent
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                    : isCompleted
                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isCurrent
                      ? 'bg-emerald-700 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : st.num}
                </span>
                <span className="text-[10px] sm:text-xs truncate max-w-full">
                  {st.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= STEP 1: MAKLUMAT ASAS & BENGKEL ================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Langkah 1: Maklumat Asas & Bengkel / Makmal
              </h3>
              <p className="text-xs text-slate-500">
                Isi maklumat peralatan dan bengkel JKM
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                HIRARC NUMBER <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.hirNo}
                onChange={(e) => handleMetaChange('hirNo', e.target.value)}
                placeholder="Cth: 01, 02, 03"
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                TITLE (Aktiviti / Proses / Peralatan) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.title}
                list="list-title-opt-ms"
                onChange={(e) => handleMetaChange('title', e.target.value)}
                placeholder="Cth: EDM WIRE CUT / CNC LATHE MACHINE"
                className="w-full border border-slate-300 rounded-lg p-2.5 font-semibold text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <datalist id="list-title-opt-ms">
                {TITLE_SUGGESTIONS.map((t, idx) => (
                  <option key={idx} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                DEPARTMENT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.dept}
                onChange={(e) => handleMetaChange('dept', e.target.value)}
                placeholder="MECHANICAL ENGINEERING DEPARTMENT"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                LOCATION / EQUIPMENT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.location}
                list="list-workshops-jkm-ms"
                onChange={(e) => handleMetaChange('location', e.target.value)}
                placeholder="Pilih atau taip bengkel/makmal JKM"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <datalist id="list-workshops-jkm-ms">
                {workshopNames.map((w, idx) => (
                  <option key={idx} value={w} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                PREPARED BY (Pegawai Penilai) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.preparedBy}
                onChange={(e) => handleMetaChange('preparedBy', e.target.value)}
                placeholder="Nama staf / penilai keselamatan"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                DATE (Tarikh Penilaian) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data.date}
                onChange={(e) => handleMetaChange('date', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 2: WORK ACTIVITY & HAZARD IDENTIFICATION ================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-200">
          {/* Row selector strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Langkah 2: Pengenalpastian Hazard (Hazard Identification)
              </h3>
              <p className="text-xs text-slate-500">
                Kenal pasti aktiviti kerja, punca bahaya dan kesan kepada manusia/harta benda
              </p>
            </div>

            {/* Row badges selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {data.rows.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRowIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeRowIdx === idx
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Hazard #{idx + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1"
                title="Tambah baris hazard baharu"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {activeRow && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800">
                    Sedang Mengedit: Hazard #{activeRowIdx + 1} daripada {data.rows.length}
                  </span>
                  <div className="flex items-center gap-1.5 ml-3">
                    <label className="text-[11px] font-bold text-slate-600">Rutin Aktiviti:</label>
                    <select
                      value={activeRow.rnr}
                      onChange={(e) => handleRowChange('rnr', e.target.value as RoutineType)}
                      className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white font-semibold"
                    >
                      <option value="R">R (Routine - Harian/Amali)</option>
                      <option value="NR">NR (Non-routine - Penyelenggaraan)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDuplicateRow(activeRowIdx)}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-slate-200 text-xs font-semibold flex items-center gap-1"
                    title="Salin baris ini"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Salin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(activeRowIdx)}
                    className="p-1.5 text-slate-600 hover:text-red-700 rounded-lg hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                    title="Padam baris ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Padam</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    1. Work Activity (Aktiviti Kerja Bengkel) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={activeRow.workActivity}
                    onChange={(e) => handleRowChange('workActivity', e.target.value)}
                    placeholder='Contoh: Proses "EDM Wire Cut" Machine / Mengetuk bendakerja di atas andas'
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Nyatakan tugas atau operasi fizikal yang dijalankan oleh operator/pelajar.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2. Hazard (Punca Bahaya Fizikal / Mekanikal / Kimia) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={activeRow.hazard}
                    onChange={(e) => handleRowChange('hazard', e.target.value)}
                    placeholder="Contoh: Pergerakan komponen mekanikal / Mata alat cutting tool berputar laju"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Apakah punca, situasi, atau objek yang berpotensi menyebabkan kemudaratan?
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Effect (Kesan, Kecederaan atau Kemusnahan Harta Benda)
                  </label>
                  <textarea
                    value={activeRow.effect}
                    onChange={(e) => handleRowChange('effect', e.target.value)}
                    placeholder="Contoh: Kecederaan fizikal tangan dan kaki, luka terhiris, kerengsaan mata"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Apakah jenis kecederaan atau akibat sekiranya hazard ini tidak dikawal?
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: RISK ANALYSIS (L & S) ================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Langkah 3: Analisis & Penilaian Risiko (Risk Analysis)
              </h3>
              <p className="text-xs text-slate-500">
                Kira skor matriks Kemungkinan (Likelihood) &times; Keterukan (Severity) mengikut standard JKKP
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenMatrix}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Buka Jadual Matriks 5Ã—5 JKKP</span>
            </button>
          </div>

          {activeRow && (
            <div className="space-y-5">
              {/* Active row identifier */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-xs text-slate-900">
                  Hazard #{activeRowIdx + 1}: <span className="font-normal text-slate-600">{activeRow.hazard || 'Hazard tanpa nama'}</span>
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${activeRisk.badgeClass}`}>
                  Skor: {activeScore} ({activeRisk.level})
                </span>
              </div>

              {/* 4. Existing Control */}
              <div className="text-xs">
                <label className="block font-bold text-slate-700 mb-1">
                  4. Existing Control Measures (Langkah Kawalan Sedia Ada)
                </label>
                <textarea
                  value={activeRow.existingControl}
                  onChange={(e) => handleRowChange('existingControl', e.target.value)}
                  placeholder="â€¢ Kawalan pentadbiran dan SOP&#10;â€¢ Pemakaian PPE (Kasut keselamatan, gogal)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Kawalan yang sedang beroperasi di bengkel semasa penilaian dibuat.
                </span>
              </div>

              {/* Likelihood & Severity Selectors with Full Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Likelihood */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-slate-900">
                      Kemungkinan / Likelihood (L):
                    </label>
                    <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      Nilai: {activeRow.l}
                    </span>
                  </div>
                  <select
                    value={activeRow.l}
                    onChange={(e) => handleRowChange('l', Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {[5, 4, 3, 2, 1].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {LIKELIHOOD_DEF[lvl].text}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <strong>Penerangan:</strong> {LIKELIHOOD_DEF[activeRow.l]?.desc}
                  </p>
                </div>

                {/* Severity */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-slate-900">
                      Keterukan / Severity (S):
                    </label>
                    <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      Nilai: {activeRow.s}
                    </span>
                  </div>
                  <select
                    value={activeRow.s}
                    onChange={(e) => handleRowChange('s', Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {[5, 4, 3, 2, 1].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {SEVERITY_DEF[lvl].text}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <strong>Penerangan:</strong> {SEVERITY_DEF[activeRow.s]?.desc}
                  </p>
                </div>
              </div>

              {/* Dynamic Risk Result Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono text-lg ${activeRisk.badgeClass}`}>
                    {activeScore}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Skor Risiko: {activeRow.l} (L) &times; {activeRow.s} (S) = {activeScore}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Tahap Risiko: <strong>{activeRisk.level}</strong> Â· {
                        activeRisk.level === 'High'
                          ? 'Tindakan segera wajib diambil!'
                          : activeRisk.level === 'Medium'
                          ? 'Pendekatan kawalan terancang diperlukan.'
                          : 'Risiko boleh diterima, pantau secara berkala.'
                      }
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onOpenMatrix}
                    className="text-xs text-emerald-800 hover:underline font-semibold"
                  >
                    Lihat panduan tindakan JKKP &rarr;
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(4);
                      handleAiSuggestControl(activeRowIdx);
                    }}
                    className="px-3 py-1.5 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all"
                    title="Analisis risiko ini dan cadangkan hierarki kawalan dengan penyedia AI pilihan"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-white/20" />
                    <span>Cadang Kawalan Dengan AI &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 4: RISK CONTROL MEASURES & PIC ================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Langkah 4: Langkah Kawalan Disyorkan & Tanggungjawab (PIC)
              </h3>
              <p className="text-xs text-slate-500">
                Tetapkan kawalan tambahan mengikut hirarki kawalan, penanggungjawab dan tarikh sasaran siap
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Pilih Workers AI atau BYOK (Gemini, DeepSeek)"
                >
                  <Settings2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tetapan AI</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkAiSuggestAll}
                disabled={isAiSuggesting}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Jana cadangan kawalan untuk semua baris hazard serentak"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Jana Semua Baris (AI)</span>
              </button>
            </div>
          </div>

          {/* AI Notice Banner */}
          {aiNotice && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                aiNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                  : aiNotice.type === 'error'
                  ? 'bg-red-50 text-red-950 border-red-300'
                  : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isAiSuggesting ? (
                  <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                ) : aiNotice.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-medium">{aiNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiNotice(null)}
                className="text-slate-400 hover:text-slate-700 p-0.5 text-base leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {activeRow && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-xs text-slate-900">
                  Hazard #{activeRowIdx + 1}: <span className="font-normal text-slate-600">{activeRow.hazard || 'Hazard Tanpa Nama'}</span>
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${activeRisk.badgeClass}`}>
                  {activeRisk.level} ({activeScore})
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Langkah Kawalan Tambahan yang Disyorkan (Recommended Control Measures)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAiSuggestControl(activeRowIdx)}
                      disabled={isAiSuggesting}
                      className="px-2.5 py-1 text-xs font-bold bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                      title="Gunakan penyedia AI pilihan untuk menganalisis hazard & cadangkan kawalan"
                    >
                      {isAiSuggesting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menjana AI...</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5" />
                          <span>Cadang Kawalan (AI)</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={activeRow.recommendedControl}
                    onChange={(e) => handleRowChange('recommendedControl', e.target.value)}
                    placeholder="Contoh: Pasang interlocking guard / Servis penapis LEV / Kawalan sedia ada telah mencukupi"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Gunakan prinsip Hirarki Kawalan: Penghapusan &rarr; Penggantian &rarr; Pengasingan &rarr; Kejuruteraan &rarr; Pentadbiran &rarr; PPE.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Person In Charge (PIC / Pegawai Bertanggungjawab)
                    </label>
                    <input
                      type="text"
                      value={activeRow.pic}
                      onChange={(e) => handleRowChange('pic', e.target.value)}
                      placeholder="Nama staf / pegawai bengkel"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Due Date (Tarikh Sasaran Siap)
                    </label>
                    <input
                      type="date"
                      value={activeRow.dueDate}
                      onChange={(e) => handleRowChange('dueDate', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Status Tindakan
                    </label>
                    <select
                      value={activeRow.status}
                      onChange={(e) => handleRowChange('status', e.target.value as ActionStatus)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Selesai">âœ… Selesai</option>
                      <option value="Dalam Tindakan">â³ Dalam Tindakan</option>
                      <option value="Belum Selesai">âŒ Belum Selesai</option>
                      <option value="Kekal / Sedia Ada">ðŸ”’ Kekal / Sedia Ada</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Supporting photos attachment */}
              <div className="pt-3 border-t border-slate-100">
                <FileUploadSection files={files} onFilesChange={onFilesChange} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 5: REVIEW, PRINT & SUBMIT ================= */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-200">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Langkah 5: Semakan Akhir, Cetakan PDF & Penghantaran
            </h3>
            <p className="text-xs text-slate-500">
              Sila semak jadual lengkap HIRARC sebelum mencetak atau menyimpan laporan rasmi
            </p>
          </div>

          {/* Quick Header Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Tajuk / Aktiviti:</span>
              <strong className="text-slate-900">{data.title || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Lokasi / Bengkel:</span>
              <strong className="text-slate-900">{data.location || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Pegawai Penilai:</span>
              <strong className="text-slate-900">{data.preparedBy || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Jumlah Hazard:</span>
              <strong className="text-slate-900">{data.rows.length} item dinilai</strong>
            </div>
          </div>

          {/* Compact Review Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th className="p-2 w-10 text-center">No</th>
                  <th className="p-2 w-14 text-center">Rutin</th>
                  <th className="p-2">Aktiviti Kerja</th>
                  <th className="p-2">Hazard</th>
                  <th className="p-2 w-12 text-center">L</th>
                  <th className="p-2 w-12 text-center">S</th>
                  <th className="p-2 w-20 text-center">Skor</th>
                  <th className="p-2">Kawalan Disyorkan</th>
                  <th className="p-2 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.rows.map((r, idx) => {
                  const score = Number(r.l) * Number(r.s);
                  const risk = getRiskLevel(score);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 text-center font-bold">{r.rnr}</td>
                      <td className="p-2 font-medium text-slate-800">{r.workActivity || '-'}</td>
                      <td className="p-2 text-slate-700">{r.hazard || '-'}</td>
                      <td className="p-2 text-center font-mono">{r.l}</td>
                      <td className="p-2 text-center font-mono">{r.s}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${risk.badgeClass}`}>
                          {score} ({risk.level})
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">{r.recommendedControl || '-'}</td>
                      <td className="p-2">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Strip: Print & Submit */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {onExportPdf && (
                <button
                  type="button"
                  onClick={onExportPdf}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Simpan PDF (jsPDF)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onPrint(false)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lampiran 1 (Format Rasmi PK-06)</span>
              </button>
              <button
                type="button"
                onClick={() => onPrint(true)}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <span>ðŸ“„ Cetak Borang Kosong</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Menghantar Laporan...' : 'Hantar & Simpan Laporan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step Navigation Controls (Prev / Next Buttons) */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
        <button
          type="button"
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Langkah Sebelumnya</span>
        </button>

        <span className="text-xs font-bold text-slate-600">
          Langkah {currentStep} / {steps.length}: <span className="text-emerald-700">{steps[currentStep - 1].label}</span>
        </span>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>Langkah Seterusnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Selesai & Hantar</span>
          </button>
        )}
      </div>
    </div>
  );
};


