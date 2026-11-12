import { CheckSquare, AlertTriangle, CheckCircle2, MinusCircle, Printer, Send, Download } from 'lucide-react';
import { ChecklistData, ChecklistItem, ChecklistAnswer } from '../types/safety';
import { INITIAL_CHECKLIST_SECTIONS } from '../data/presets';
import { usePortalData } from '../hooks/usePortalData';

interface ChecklistFormProps {
  data: ChecklistData;
  onChange: (updated: ChecklistData) => void;
  onSubmit: () => void;
  onPrint: (isBlank: boolean) => void;
  onExportPdf?: () => void;
  isSubmitting?: boolean;
  lastAutoSaveTime?: string | null;
  onResetDraft?: () => void;
}

export const ChecklistForm: React.FC<ChecklistFormProps> = ({
  data,
  onChange,
  onSubmit,
  onPrint,
  onExportPdf,
  isSubmitting = false,
  lastAutoSaveTime,
  onResetDraft
}) => {
  const { workshopNames } = usePortalData();

  const handleMetaChange = (field: keyof Omit<ChecklistData, 'items'>, value: string) => {
    onChange({
      ...data,
      [field]: value
    });
  };

  const handleItemAnswer = (itemId: string, answer: ChecklistAnswer) => {
    const updated = data.items.map((it) => (it.id === itemId ? { ...it, jawapan: answer } : it));
    onChange({
      ...data,
      items: updated
    });
  };

  const handleItemCatatan = (itemId: string, catatan: string) => {
    const updated = data.items.map((it) => (it.id === itemId ? { ...it, catatan } : it));
    onChange({
      ...data,
      items: updated
    });
  };

  // Compute compliance statistics
  let yaCount = 0;
  let tidakCount = 0;
  let naCount = 0;
  let unanswered = 0;

  data.items.forEach((it) => {
    if (it.jawapan === 'Ya') yaCount++;
    else if (it.jawapan === 'Tidak') tidakCount++;
    else if (it.jawapan === 'NA') naCount++;
    else unanswered++;
  });

  const totalEvaluated = yaCount + tidakCount;
  const complianceRate = totalEvaluated > 0 ? Math.round((yaCount / totalEvaluated) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* Maklumat Pemeriksaan & Score Meter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3.5 mb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Senarai Semak Pemeriksaan Keselamatan Bengkel
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Lampiran 2B (PK-06)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemeriksaan berkala persekitaran kerja, mesin, bahan kimia dan kelengkapan PPE
            </p>
          </div>

          {/* Auto-Save & Compliance Meter Card */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-semibold" title="Borangan ini disimpan automatik ke localStorage setiap 30 saat">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span>Auto-Save (30s): {lastAutoSaveTime ? `Disimpan ${lastAutoSaveTime}` : 'Aktif'}</span>
            </div>

            {onResetDraft && (
              <button
                type="button"
                onClick={onResetDraft}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-colors"
                title="Selesaikan draf dan mula senarai semak bersih"
              >
                Reset Draf
              </button>
            )}

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Kadar Pematuhan
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 leading-none">
                  {complianceRate}%
                </div>
              </div>
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200 text-xs">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold" title="Patuh">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{yaCount}</span>
                </span>
                <span className="flex items-center gap-1 text-red-600 font-semibold" title="Tidak Patuh">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{tidakCount}</span>
                </span>
                <span className="flex items-center gap-1 text-slate-500 font-semibold" title="Tidak Berkenaan">
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>{naCount}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              NAMA PEMERIKSA / PEGAWAI <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.nama}
              onChange={(e) => handleMetaChange('nama', e.target.value)}
              placeholder="Nama pegawai pemeriksa"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              LOKASI / BENGKEL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.lokasi}
              list="list-bengkel-jkm-l2b"
              onChange={(e) => handleMetaChange('lokasi', e.target.value)}
              placeholder="Pilih atau taip bengkel JKM"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <datalist id="list-bengkel-jkm-l2b">
              {workshopNames.map((w, idx) => (
                <option key={idx} value={w} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              TARIKH PEMERIKSAAN <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={data.tarikh}
              onChange={(e) => handleMetaChange('tarikh', e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Senarai Semak Perkara Pemeriksaan
          </h3>
          <p className="text-xs text-slate-500">
            Pilih status (Ya / Tidak / NA) untuk setiap perkara pemeriksaan berkanun
          </p>
        </div>

        <div className="space-y-5">
          {INITIAL_CHECKLIST_SECTIONS.map((sec, sIdx) => {
            const sectionItems = data.items.filter((it) => it.seksyen === sec.seksyen);

            return (
              <div
                key={sIdx}
                className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
              >
                <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    {sec.seksyen}
                  </h4>
                </div>

                <div className="divide-y divide-slate-200/70 p-2 sm:p-3 space-y-2">
                  {sectionItems.map((item, iIdx) => {
                    const itemNumber = sIdx * 4 + iIdx + 1;

                    return (
                      <div
                        key={item.id}
                        className="p-2 sm:p-2.5 rounded-lg bg-white border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 text-slate-800 font-medium">
                          <span className="font-bold text-slate-900 mr-1.5">{itemNumber}.</span>
                          <span>{item.item}</span>
                        </div>

                        {/* Radio options: Ya / Tidak / NA */}
                        <div className="flex items-center gap-3 shrink-0 bg-slate-50 border border-slate-200 p-1.5 rounded-lg">
                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                            item.jawapan === 'Ya' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                          }`}>
                            <input
                              type="radio"
                              name={`rad_${item.id}`}
                              value="Ya"
                              checked={item.jawapan === 'Ya'}
                              onChange={() => handleItemAnswer(item.id, 'Ya')}
                              className="hidden"
                            />
                            <span>Ya</span>
                          </label>

                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                            item.jawapan === 'Tidak' ? 'bg-red-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                          }`}>
                            <input
                              type="radio"
                              name={`rad_${item.id}`}
                              value="Tidak"
                              checked={item.jawapan === 'Tidak'}
                              onChange={() => handleItemAnswer(item.id, 'Tidak')}
                              className="hidden"
                            />
                            <span>Tidak</span>
                          </label>

                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                            item.jawapan === 'NA' ? 'bg-slate-700 text-white font-bold shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                          }`}>
                            <input
                              type="radio"
                              name={`rad_${item.id}`}
                              value="NA"
                              checked={item.jawapan === 'NA'}
                              onChange={() => handleItemAnswer(item.id, 'NA')}
                              className="hidden"
                            />
                            <span>NA</span>
                          </label>
                        </div>

                        {/* Catatan input */}
                        <div className="w-full md:w-64 shrink-0">
                          <input
                            type="text"
                            value={item.catatan}
                            onChange={(e) => handleItemCatatan(item.id, e.target.value)}
                            placeholder="Catatan / Tindakan pembetulan"
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
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
              <span>ðŸ“„ Borang Kosong (Templat)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Menghantar Laporan...' : 'Hantar Laporan Pemeriksaan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

