import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  Server,
  ShieldCheck,
  Users
} from 'lucide-react';
import { roleLabel } from '../../shared/roles';
import type { UserProfile } from '../types/auth';
import {
  getHealth,
  getMasterData,
  type HealthStatus,
  type MasterData
} from '../services/portalApi';
import { Modal } from './ui/Modal';

interface CloudflareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
}

type Tab = 'status' | 'master' | 'access';

function StatusRow({
  label,
  healthy,
  detail,
  icon
}: {
  label: string;
  healthy: boolean;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 flex items-start gap-3 bg-white">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          {label}
          {healthy ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          )}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{detail}</div>
      </div>
    </div>
  );
}

export const CloudflareModal: React.FC<CloudflareModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('status');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');

    Promise.all([getHealth(), getMasterData().catch(() => null)])
      .then(([loadedHealth, loadedMasterData]) => {
        if (cancelled) return;
        setHealth(loadedHealth);
        setMasterData(loadedMasterData);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Tidak dapat menghubungi Worker. Pastikan npm run dev:api berjalan.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Status Infrastruktur Cloudflare"
      subtitle="D1 · KV · R2 · Workers AI melalui Hono Worker"
      icon={<Cloud className="w-5 h-5" />}
      maxWidthClassName="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['status', 'Status Sistem'],
              ['master', 'Data Induk D1'],
              ['access', 'Peranan PBAC']
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                tab === value
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuatkan status sistem...
          </div>
        ) : tab === 'status' && health ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <StatusRow
                label="Cloudflare D1"
                healthy={health.bindings.d1}
                detail="Dokumen, pengguna, aliran kerja semakan dan log audit."
                icon={<Database className="w-4 h-4" />}
              />
              <StatusRow
                label="KV Namespace"
                healthy={health.bindings.kv}
                detail="Sesi log masuk, cache AI dan had kadar percubaan log masuk."
                icon={<KeyRound className="w-4 h-4" />}
              />
              <StatusRow
                label="R2 Bucket"
                healthy={health.bindings.r2}
                detail="Lampiran gambar/PDF dokumen keselamatan."
                icon={<HardDrive className="w-4 h-4" />}
              />
              <StatusRow
                label="Workers AI"
                healthy={health.bindings.workersAi}
                detail={`Lalai: ${health.ai.defaultModel}`}
                icon={<Bot className="w-4 h-4" />}
              />
              <StatusRow
                label="Log Masuk Kata Laluan"
                healthy
                detail={
                  health.auth.allowedDomain
                    ? `Pendaftaran terhad kepada @${health.auth.allowedDomain}`
                    : 'Pendaftaran terbuka · kelulusan Pentadbir Sistem diperlukan'
                }
                icon={<ShieldCheck className="w-4 h-4" />}
              />
              <StatusRow
                label="Kelulusan Akaun"
                healthy={health.auth.registration === 'admin_approval'}
                detail="Akaun baharu berstatus menunggu sehingga diluluskan Pentadbir Sistem."
                icon={<Users className="w-4 h-4" />}
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-emerald-700" />
                Konfigurasi AI
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1">
                <li>Penyedia lalai: Cloudflare Workers AI</li>
                <li>Model lalai: {health.ai.defaultModel}</li>
                <li>
                  BYOK: {health.ai.byokEnabled ? 'didayakan (kunci disulitkan AES-GCM)' : 'belum didayakan — tetapkan AI_KEY_ENCRYPTION_SECRET'}
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Semua operasi D1, KV, R2 dan AI dilaksanakan di Worker. Tiada token API Cloudflare
                disimpan dalam pelayar. Endpoint kesihatan: <code className="font-mono">/api/health</code>.
              </span>
            </div>
          </div>
        ) : tab === 'master' && masterData ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <div className="text-[10px] uppercase font-bold text-slate-500">Jabatan</div>
                <div className="text-lg font-bold text-slate-900">{masterData.departments.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <div className="text-[10px] uppercase font-bold text-slate-500">Bengkel/Makmal</div>
                <div className="text-lg font-bold text-slate-900">{masterData.workshops.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <div className="text-[10px] uppercase font-bold text-slate-500">Matriks Risiko</div>
                <div className="text-lg font-bold text-slate-900">{masterData.riskMatrix.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <div className="text-[10px] uppercase font-bold text-slate-500">Peranan</div>
                <div className="text-lg font-bold text-slate-900">{masterData.roles.length}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" />
                Senarai Bengkel & Makmal
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {masterData.workshops.map((workshop) => (
                  <div key={workshop.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">{workshop.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {workshop.code} · {workshop.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tab === 'access' ? (
          <div className="space-y-3">
            {currentUser ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3 bg-white">
                  <div className="font-bold text-slate-900">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                  <div className="mt-2 inline-flex px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {roleLabel(currentUser.role, currentUser.isSystemAdmin)}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Jabatan: {currentUser.department} · Bengkel: {currentUser.workshopLocation || 'Tiada'}
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-800 mb-1.5">Kebenaran PBAC</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentUser.permissions ?? []).map((permission) => (
                      <span
                        key={permission}
                        className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                Log masuk untuk melihat peranan dan kebenaran PBAC anda.
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            Status sistem tidak tersedia.
          </div>
        )}
      </div>
    </Modal>
  );
};

