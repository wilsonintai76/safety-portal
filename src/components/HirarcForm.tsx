import React, { useState } from 'react';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, Sparkles, AlertCircle, HelpCircle, Loader2, Bot } from 'lucide-react';
import { HirarcData, HirarcRow, RoutineType, ActionStatus } from '../types/safety';
import { suggestControls } from '../services/portalApi';
import {
  TITLE_SUGGESTIONS,
  LIKELIHOOD_DEF,
  SEVERITY_DEF,
  getRiskLevel
} from '../data/presets';
import { usePortalData } from '../hooks/usePortalData';

interface HirarcFormProps {
  data: HirarcData;
  onChange: (updated: HirarcData) => void;
  onOpenMatrix: () => void;
}

export const HirarcForm: React.FC<HirarcFormProps> = ({ data, onChange, onOpenMatrix }) => {
  const { workshopNames } = usePortalData();
  const [loadingRowIdx, setLoadingRowIdx] = useState<number | null>(null);

  const handleMetadataChange = (field: keyof Omit<HirarcData, 'rows'>, value: string) => {
    onChange({
      ...data,
      [field]: value
    });
  };

  const handleAiSuggestRow = async (index: number) => {
    const row = data.rows[index];
    if (!row) return;

    setLoadingRowIdx(index);
    try {
      const res = await suggestControls({
        workActivity: row.workActivity,
        hazard: row.hazard,
        effect: row.effect,
        existingControl: row.existingControl,
        likelihood: Number(row.l) || 2,
        severity: Number(row.s) || 2,
        workshop: data.location
      });

      if (res.success && res.suggestion) {
        handleRowChange(index, 'recommendedControl', res.suggestion);
        handleRowChange(index, 'status', 'Dalam Tindakan');
      }
    } catch (e) {
      console.error('Failed to suggest control with the configured AI provider', e);
    } finally {
      setLoadingRowIdx(null);
    }
  };

  const handleRowChange = (index: number, field: keyof HirarcRow, value: any) => {
    const updatedRows = [...data.rows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    onChange({
      ...data,
      rows: updatedRows
    });
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
      pic: data.preparedBy || 'Pegawai Bertugas',
      dueDate: '',
      status: 'Selesai'
    };
    onChange({
      ...data,
      rows: [...data.rows, newRow]
    });
  };

  const handleDuplicateRow = (index: number) => {
    const target = data.rows[index];
    const duplicated: HirarcRow = {
      ...target,
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
    const updatedRows = [...data.rows];
    updatedRows.splice(index + 1, 0, duplicated);
    onChange({
      ...data,
      rows: updatedRows
    });
  };

  const handleDeleteRow = (index: number) => {
    if (data.rows.length <= 1) {
      alert('Borang HIRARC memerlukan sekurang-kurangnya satu baris hazard.');
      return;
    }
    const updatedRows = data.rows.filter((_, idx) => idx !== index);
    onChange({
      ...data,
      rows: updatedRows
    });
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= data.rows.length) return;
    const updatedRows = [...data.rows];
    const temp = updatedRows[index];
    updatedRows[index] = updatedRows[newIdx];
    updatedRows[newIdx] = temp;
    onChange({
      ...data,
      rows: updatedRows
    });
  };

  return (
    <div className="space-y-5">
      {/* Maklumat Borang & Preset Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 mb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Maklumat Asas Borang HIRARC (Lampiran 1)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                PK-06(1)(01-07-22)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Format Standard Jabatan Kejuruteraan Mekanikal (JKM) Politeknik Malaysia
            </p>
          </div>
        </div>

        {/* 6 Input Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              HIRARC NUMBER <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.hirNo}
              onChange={(e) => handleMetadataChange('hirNo', e.target.value)}
              placeholder="Cth: 01, 02, 03"
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              TITLE (Aktiviti / Proses / Peralatan) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.title}
              list="list-title-opt"
              onChange={(e) => handleMetadataChange('title', e.target.value)}
              placeholder="Cth: EDM WIRE CUT / KERJA KIMPALAN ARKA"
              className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <datalist id="list-title-opt">
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
              onChange={(e) => handleMetadataChange('dept', e.target.value)}
              placeholder="MECHANICAL ENGINEERING DEPARTMENT"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              LOCATION / EQUIPMENT <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.location}
              list="list-workshops-jkm"
              onChange={(e) => handleMetadataChange('location', e.target.value)}
              placeholder="Pilih atau taip bengkel/makmal JKM"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <datalist id="list-workshops-jkm">
              {workshopNames.map((w, idx) => (
                <option key={idx} value={w} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              PREPARED BY (Penilai Keselamatan) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.preparedBy}
              onChange={(e) => handleMetadataChange('preparedBy', e.target.value)}
              placeholder="Nama pensyarah / staf penilai"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              DATE (Tarikh Penilaian) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => handleMetadataChange('date', e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Hazard Items Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-slate-200 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Jadual Pengenalpastian Hazard, Analisis & Kawalan Risiko
            </h3>
            <p className="text-xs text-slate-500">
              Lajur merangkumi No, R/NR, Work Activity, Hazard, Effect, Existing Control, L, S, Risk (LÃ—S), Recommended Control &amp; PIC
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Baris Hazard</span>
          </button>
        </div>

        {/* List of Dynamic Hazard Rows */}
        <div className="space-y-4">
          {data.rows.map((row, index) => {
            const score = Number(row.l) * Number(row.s);
            const risk = getRiskLevel(score);

            return (
              <div
                key={row.id}
                className="border border-slate-200 rounded-xl p-3.5 sm:p-4 bg-slate-50/70 hover:bg-slate-50 transition-colors shadow-2xs space-y-3"
              >
                {/* Top strip of card */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center font-mono">
                      {index + 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600">Rutin:</label>
                      <select
                        value={row.rnr}
                        onChange={(e) => handleRowChange(index, 'rnr', e.target.value as RoutineType)}
                        className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white font-semibold focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="R">R (Routine)</option>
                        <option value="NR">NR (Non-routine)</option>
                      </select>
                    </div>
                  </div>

                  {/* Risk Badge & Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenMatrix}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer transition-transform hover:scale-102 ${risk.badgeClass}`}
                      title="Klik untuk panduan matriks skor"
                    >
                      <span className="tabular-nums font-mono">Skor: {score}</span>
                      <span>({risk.level})</span>
                      <HelpCircle className="w-3 h-3 ml-0.5 opacity-70" />
                    </button>

                    <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => handleMoveRow(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100"
                        title="Alih ke atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRow(index, 'down')}
                        disabled={index === data.rows.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100"
                        title="Alih ke bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(index)}
                        className="p-1 text-slate-500 hover:text-emerald-700 rounded hover:bg-slate-100"
                        title="Salin baris ini"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(index)}
                        className="p-1 text-slate-500 hover:text-red-700 rounded hover:bg-red-50"
                        title="Padam baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main 4 textarea inputs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      1. Work Activity (Aktiviti Kerja) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={row.workActivity}
                      onChange={(e) => handleRowChange(index, 'workActivity', e.target.value)}
                      placeholder='Cth: Proses "EDM Wire Cut" Machine'
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white h-20 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      2. Hazard (Punca Bahaya) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={row.hazard}
                      onChange={(e) => handleRowChange(index, 'hazard', e.target.value)}
                      placeholder="Cth: Pergerakan komponen mekanikal / Tatal tajam"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white h-20 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      3. Effect (Kesan / Akibat)
                    </label>
                    <textarea
                      value={row.effect}
                      onChange={(e) => handleRowChange(index, 'effect', e.target.value)}
                      placeholder="Cth: Kecederaan fizikal tangan dan kaki"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white h-20 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      4. Existing Control (Kawalan Sedia Ada)
                    </label>
                    <textarea
                      value={row.existingControl}
                      onChange={(e) => handleRowChange(index, 'existingControl', e.target.value)}
                      placeholder="â€¢ Kawalan pentadbiran dan SOP&#10;â€¢ Pemakaian PPE"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white h-20 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Evaluation strip: L, S, Recommended, PIC, Due Date, Status */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs items-end">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Likelihood (L):
                    </label>
                    <select
                      value={row.l}
                      onChange={(e) => handleRowChange(index, 'l', Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {[5, 4, 3, 2, 1].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {LIKELIHOOD_DEF[lvl].text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Severity (S):
                    </label>
                    <select
                      value={row.s}
                      onChange={(e) => handleRowChange(index, 's', Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {[5, 4, 3, 2, 1].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {SEVERITY_DEF[lvl].text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">
                        Recommended:
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAiSuggestRow(index)}
                        disabled={loadingRowIdx === index}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50"
                        title="Jana cadangan kawalan dengan penyedia AI pilihan"
                      >
                        {loadingRowIdx === index ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-2.5 h-2.5" />
                        )}
                        <span>AI</span>
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={row.recommendedControl}
                      onChange={(e) => handleRowChange(index, 'recommendedControl', e.target.value)}
                      placeholder="Kawalan sedia ada telah mencukupi"
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      PIC (Tanggungjawab):
                    </label>
                    <input
                      type="text"
                      value={row.pic}
                      onChange={(e) => handleRowChange(index, 'pic', e.target.value)}
                      placeholder="Nama penanggungjawab"
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Due Date (Sasaran Siap):
                    </label>
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => handleRowChange(index, 'dueDate', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Status Tindakan:
                    </label>
                    <select
                      value={row.status}
                      onChange={(e) => handleRowChange(index, 'status', e.target.value as ActionStatus)}
                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Selesai">âœ… Selesai</option>
                      <option value="Dalam Tindakan">â³ Dalam Tindakan</option>
                      <option value="Belum Selesai">âŒ Belum Selesai</option>
                      <option value="Kekal / Sedia Ada">ðŸ”’ Kekal / Sedia Ada</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom helper */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleAddRow}
            className="w-full sm:w-auto px-4 py-2 border border-dashed border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Baris Hazard Seterusnya</span>
          </button>

          <div className="text-xs text-slate-500 text-center sm:text-right">
            Panduan Skor JKKP: <strong>1â€“4 Low</strong> (Diterima) Â· <strong>5â€“12 Medium</strong> (Terancang) Â· <strong>15â€“25 High</strong> (Tindakan Segera)
          </div>
        </div>
      </div>
    </div>
  );
};

