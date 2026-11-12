import React, { useState } from 'react';
import { X, ShieldAlert, Info, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';
import { LIKELIHOOD_DEF, SEVERITY_DEF, getRiskLevel } from '../data/presets';

interface MatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCoordinates?: (l: number, s: number) => void;
}

export const MatrixModal: React.FC<MatrixModalProps> = ({ isOpen, onClose, onSelectCoordinates }) => {
  const [selectedCell, setSelectedCell] = useState<{ l: number; s: number } | null>(null);

  if (!isOpen) return null;

  const likelihoodRows = [5, 4, 3, 2, 1];
  const severityCols = [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Matriks Risiko 5×5 & Garis Panduan Penilaian JKKP (PK-06)
              </h3>
              <p className="text-xs text-slate-500">
                Format Rasmi Standard Jabatan Keselamatan dan Kesihatan Pekerjaan Malaysia (DOSH/JKKP 2008)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Interactive Matrix 5x5 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Jadual Matriks Penilaian Risiko (L × S)</h4>
              <span className="text-[11px] text-slate-500">Klik mana-mana sel untuk melihat butiran interaktif</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white p-2">
              <table className="w-full text-center border-collapse text-xs font-semibold">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-200 p-2 font-bold" rowSpan={2}>
                      Kemungkinan / Likelihood (L)
                    </th>
                    <th className="border border-slate-200 p-2 font-bold" colSpan={5}>
                      Keterukan / Severity (S)
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-[11px] text-slate-600">
                    <th className="border border-slate-200 p-1.5">1 (Negligible)</th>
                    <th className="border border-slate-200 p-1.5">2 (Minor)</th>
                    <th className="border border-slate-200 p-1.5">3 (Serious)</th>
                    <th className="border border-slate-200 p-1.5">4 (Fatal)</th>
                    <th className="border border-slate-200 p-1.5">5 (Catastrophic)</th>
                  </tr>
                </thead>
                <tbody>
                  {likelihoodRows.map((l) => (
                    <tr key={l}>
                      <td className="border border-slate-200 p-2 text-left font-bold bg-slate-50/70 text-slate-800">
                        {LIKELIHOOD_DEF[l].text}
                      </td>
                      {severityCols.map((s) => {
                        const score = l * s;
                        const risk = getRiskLevel(score);
                        const isSelected = selectedCell?.l === l && selectedCell?.s === s;
                        let bgClass = 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
                        if (risk.level === 'Medium') bgClass = 'bg-amber-100 text-amber-900 hover:bg-amber-200';
                        if (risk.level === 'High') bgClass = 'bg-red-200 text-red-950 hover:bg-red-300 font-bold';

                        return (
                          <td
                            key={s}
                            onClick={() => {
                              setSelectedCell({ l, s });
                              if (onSelectCoordinates) onSelectCoordinates(l, s);
                            }}
                            className={`border border-slate-200 p-2.5 cursor-pointer transition-all ${bgClass} ${
                              isSelected ? 'ring-2 ring-slate-900 scale-95 shadow-md font-bold' : ''
                            }`}
                          >
                            <div className="tabular-nums font-mono text-sm">{score}</div>
                            <div className="text-[10px] uppercase font-bold tracking-tight opacity-80">
                              {risk.level === 'High' ? 'High' : risk.level === 'Medium' ? 'Med' : 'Low'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedCell && (
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                <div>
                  <span className="font-bold text-emerald-400">
                    Nilai Dipilih: L = {selectedCell.l} × S = {selectedCell.s} = Skor {selectedCell.l * selectedCell.s} (
                    {getRiskLevel(selectedCell.l * selectedCell.s).level})
                  </span>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {LIKELIHOOD_DEF[selectedCell.l].text} · {SEVERITY_DEF[selectedCell.s].text}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="text-slate-400 hover:text-white text-[11px] underline"
                >
                  Batal pilihan
                </button>
              </div>
            )}
          </div>

          {/* Definisi Likelihood & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Likelihood */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2.5">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>Skala Kemungkinan / Likelihood (L)</span>
              </div>
              <ul className="space-y-2 text-[11.5px] leading-relaxed">
                {likelihoodRows.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="font-bold text-slate-900 shrink-0 w-28">{LIKELIHOOD_DEF[l].text}:</span>
                    <span className="text-slate-600">{LIKELIHOOD_DEF[l].desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Severity */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Skala Keterukan / Severity (S)</span>
              </div>
              <ul className="space-y-2 text-[11.5px] leading-relaxed">
                {likelihoodRows.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="font-bold text-slate-900 shrink-0 w-28">{SEVERITY_DEF[s].text}:</span>
                    <span className="text-slate-600">{SEVERITY_DEF[s].desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tindakan Mengikut Tahap Risiko */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>Tindakan Pengurusan Mengikut Tahap Risiko</span>
              <span className="text-slate-400 font-normal">· Prosedur PK-06 JKM</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-red-950 space-y-1">
                <div className="flex items-center gap-1 font-bold text-red-900 text-[12px]">
                  <Flame className="w-4 h-4 text-red-600" />
                  <span>15 – 25 : TINGGI (HIGH)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-900">
                  Memerlukan <strong>tindakan segera</strong> mengikut hirarki kawalan (penghapusan, penggantian, kawalan kejuruteraan). Kerja mungkin perlu dihentikan sehingga risiko diturunkan.
                </p>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 space-y-1">
                <div className="flex items-center gap-1 font-bold text-amber-900 text-[12px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>5 – 12 : SEDERHANA (MEDIUM)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Memerlukan <strong>pendekatan terancang</strong> untuk mengawal hazard. Kawalan sementara boleh diguna pakai sementara penyelesaian kekal dirancang dengan tarikh siap ditetapkan.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                <div className="flex items-center gap-1 font-bold text-emerald-900 text-[12px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>1 – 4 : RENDAH (LOW)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900">
                  Risiko <strong>boleh diterima</strong> (Acceptable). Pengurangan lanjut tidak diwajibkan serta-merta, namun kawalan sedia ada mesti dikekalkan dan dipantau berkala.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Akta Keselamatan & Kesihatan Pekerjaan 1994 (Akta 514) & Sistem Pengurusan Keselamatan Politeknik
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm ml-auto"
          >
            Tutup Rujukan
          </button>
        </div>
      </div>
    </div>
  );
};
