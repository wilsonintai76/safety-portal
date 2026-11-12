import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Tag,
  Layers
} from 'lucide-react';
import { usePortalData } from '../hooks/usePortalData';
import { createWorkshop, deleteWorkshop } from '../services/portalApi';
import { UserProfile } from '../types/auth';
import { Modal } from './ui/Modal';

interface WorkshopManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

export const WorkshopManagementModal: React.FC<WorkshopManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const { workshops, departments, isLoading: isDataLoading, reload } = usePortalData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<string>('ALL');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'bengkel' | 'makmal' | 'bilik'>('bengkel');
  const [blockLocation, setBlockLocation] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const canManage = Boolean(
    currentUser?.isSystemAdmin || currentUser?.permissions?.includes('master:manage')
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Sila lengkapkan Kod dan Nama bengkel/makmal.'
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await createWorkshop({
        deptId: currentUser?.deptId || departments[0]?.id,
        code: code.trim().toUpperCase(),
        name: name.trim().toUpperCase(),
        kind,
        blockLocation: blockLocation.trim() || null
      });

      setStatusMessage({
        type: 'success',
        text: `Fasiliti "${name.trim().toUpperCase()}" berjaya didaftarkan ke pangkalan data D1!`
      });

      // Reset form
      setCode('');
      setName('');
      setKind('bengkel');
      setBlockLocation('');
      setIsAdding(false);

      // Refresh master data across the entire portal
      reload();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menambah bengkel.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, wsName: string) => {
    if (!window.confirm(`Adakah anda pasti ingin memadam "${wsName}" daripada senarai fasiliti?`)) {
      return;
    }

    setDeletingId(id);
    setStatusMessage(null);

    try {
      await deleteWorkshop(id);
      setStatusMessage({
        type: 'success',
        text: `Fasiliti "${wsName}" telah berjaya dipadam.`
      });
      reload();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memadam bengkel.'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredWorkshops = workshops.filter((ws) => {
    const matchesSearch =
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ws.blockLocation && ws.blockLocation.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesKind = selectedKind === 'ALL' || ws.kind === selectedKind;

    return matchesSearch && matchesKind;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengurusan Bengkel & Makmal JKM"
      subtitle="Daftar dan urus bengkel, makmal serta bilik dalam pangkalan data Cloudflare D1"
      icon={<Building2 className="w-5 h-5 text-white" />}
      maxWidthClassName="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Permission warning if not admin */}
        {!canManage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Anda tidak mempunyai kebenaran Pentadbir Sistem untuk menambah atau memadam fasiliti. Paparan ini dalam mod baca sahaja.
            </span>
          </div>
        )}

        {/* Status notification */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : 'bg-red-50 text-red-950 border-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="flex-1">{statusMessage.text}</span>
          </div>
        )}

        {/* Top Action Bar: Search, Kind filter, and Toggle Add Form */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau kod fasiliti..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value)}
              className="py-2 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none shrink-0"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="bengkel">Bengkel</option>
              <option value="makmal">Makmal</option>
              <option value="bilik">Bilik</option>
            </select>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-2xs ${
                isAdding
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
              <span>{isAdding ? 'Batal Tambah' : 'Tambah Fasiliti'}</span>
            </button>
          )}
        </div>

        {/* Creation Form (Collapsible) */}
        {isAdding && canManage && (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3.5 animate-fadeIn"
          >
            <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 border-b border-emerald-200/80 pb-2">
              <Building2 className="w-4 h-4 text-emerald-800" />
              <span>Daftar Bengkel / Makmal Baharu ke D1</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama Fasiliti <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: BENGKEL FABRIKASI LANJUTAN"
                  required
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-semibold text-slate-800"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kod Singkatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Contoh: BFL"
                  maxLength={10}
                  required
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono font-bold text-slate-800"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Jenis Fasiliti
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'bengkel' | 'makmal' | 'bilik')}
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none capitalize font-medium text-slate-800"
                >
                  <option value="bengkel">Bengkel (Hands-on / Heavy Machinery)</option>
                  <option value="makmal">Makmal (Testing / Computing / Precision)</option>
                  <option value="bilik">Bilik (Storage / Inspection Room)</option>
                </select>
              </div>

              <div className="sm:col-span-7">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lokasi / Blok Bangunan
                </label>
                <input
                  type="text"
                  value={blockLocation}
                  onChange={(e) => setBlockLocation(e.target.value)}
                  placeholder="Contoh: Blok B, Aras Bawah, JKM"
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200/80">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Simpan Fasiliti ke D1</span>
              </button>
            </div>
          </form>
        )}

        {/* Workshops List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Senarai Fasiliti Berdaftar ({filteredWorkshops.length} daripada {workshops.length})</span>
            {isDataLoading && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Memuat data...</span>
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-95 overflow-y-auto">
            {filteredWorkshops.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Tiada bengkel atau makmal yang sepadan dengan carian.
              </div>
            ) : (
              filteredWorkshops.map((ws) => (
                <div
                  key={ws.id}
                  className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                      {ws.code}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {ws.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span
                          className={`capitalize px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                            ws.kind === 'makmal'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : ws.kind === 'bilik'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {ws.kind}
                        </span>
                        {ws.blockLocation && (
                          <span className="flex items-center gap-1 truncate text-slate-400">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{ws.blockLocation}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(ws.id, ws.name)}
                      disabled={deletingId === ws.id}
                      title={`Padam ${ws.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                    >
                      {deletingId === ws.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
