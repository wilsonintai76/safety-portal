import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  UserCog,
  UserX,
  Users
} from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '../../shared/roles';
import type { AccountStatus, UserProfile } from '../types/auth';
import {
  getMasterData,
  listUsers,
  resetUserPassword,
  updateUser,
  type AdminUser,
  type MasterData
} from '../services/portalApi';
import { Modal } from './ui/Modal';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

type Tab = 'menunggu' | 'aktif' | 'semua';

const STATUS_LABEL: Record<AccountStatus, string> = {
  menunggu: 'Menunggu kelulusan',
  aktif: 'Aktif',
  ditolak: 'Ditolak',
  nyahaktif: 'Nyahaktif'
};

const STATUS_CLASS: Record<AccountStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-900 border-amber-300',
  aktif: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ditolak: 'bg-red-50 text-red-800 border-red-300',
  nyahaktif: 'bg-slate-100 text-slate-600 border-slate-300'
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [tab, setTab] = useState<Tab>('menunggu');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canManage = Boolean(currentUser?.permissions?.includes('user:manage'));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [loadedUsers, loadedMaster] = await Promise.all([listUsers(), getMasterData()]);
      setUsers(loadedUsers);
      setMasterData(loadedMaster);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuatkan pengguna.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !canManage) return;
    void load();
  }, [isOpen, canManage, load]);

  const counts = useMemo(
    () => ({
      menunggu: users.filter((user) => user.status === 'menunggu').length,
      aktif: users.filter((user) => user.status === 'aktif').length,
      semua: users.length
    }),
    [users]
  );

  const visibleUsers = useMemo(() => {
    if (tab === 'semua') return users;
    return users.filter((user) => user.status === tab);
  }, [users, tab]);

  const handleUpdated = (updated: AdminUser) => {
    setUsers((previous) =>
      previous.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    );
  };

  if (!canManage) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Urus Pengguna & Kelulusan Akaun"
      subtitle="Pendaftaran baharu perlu diluluskan sebelum akaun boleh digunakan"
      icon={<Users className="w-5 h-5" />}
      maxWidthClassName="max-w-3xl"
    >
      <div className="space-y-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['menunggu', `Menunggu (${counts.menunggu})`],
              ['aktif', `Aktif (${counts.aktif})`],
              ['semua', `Semua (${counts.semua})`]
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
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ml-auto"
          >
            Muat semula
          </button>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            Setiap pendaftaran menunggu kelulusan. Semak identiti dan peranan yang dimohon sebelum
            meluluskan. Sekurang-kurangnya seorang Pentadbir Sistem mesti kekal aktif.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuatkan pengguna...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <UserCog className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            {tab === 'menunggu' ? 'Tiada permohonan menunggu kelulusan.' : 'Tiada pengguna.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                workshops={masterData?.workshops ?? []}
                isSelf={user.id === currentUser?.id}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

interface UserCardProps {
  user: AdminUser;
  workshops: MasterData['workshops'];
  isSelf: boolean;
  onUpdated: (user: AdminUser) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, workshops, isSelf, onUpdated }) => {
  const [role, setRole] = useState<Role>(user.role);
  const [isSystemAdmin, setIsSystemAdmin] = useState(user.isSystemAdmin);
  const [workshopId, setWorkshopId] = useState<string>(user.workshopId ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'save' | 'password' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const run = async (
    kind: 'approve' | 'reject' | 'save' | 'password',
    action: () => Promise<void>
  ) => {
    setBusy(kind);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Tindakan gagal.'
      });
    } finally {
      setBusy(null);
    }
  };

  const approve = () =>
    run('approve', async () => {
      const updated = await updateUser(user.id, { status: 'aktif', role, isSystemAdmin, workshopId: workshopId || null });
      onUpdated(updated);
      setFeedback({ type: 'success', message: 'Akaun diluluskan dan kini boleh log masuk.' });
    });

  const reject = () =>
    run('reject', async () => {
      const updated = await updateUser(user.id, { status: 'ditolak' });
      onUpdated(updated);
      setFeedback({ type: 'success', message: 'Permohonan ditolak.' });
    });

  const save = () =>
    run('save', async () => {
      const updated = await updateUser(user.id, { role, isSystemAdmin, workshopId: workshopId || null });
      onUpdated(updated);
      setFeedback({ type: 'success', message: 'Peranan dikemas kini.' });
    });

  const deactivate = () =>
    run('save', async () => {
      const updated = await updateUser(user.id, { status: 'nyahaktif' });
      onUpdated(updated);
      setFeedback({ type: 'success', message: 'Akaun dinyahaktifkan.' });
    });

  const resetPassword = () =>
    run('password', async () => {
      await resetUserPassword(user.id, newPassword);
      setNewPassword('');
      setShowPasswordReset(false);
      setFeedback({ type: 'success', message: 'Kata laluan baharu ditetapkan.' });
    });

  const isPending = user.status === 'menunggu';

  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate">
            {user.fullName}
            {user.isSystemAdmin && (
              <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-700 text-white">
                PENTADBIR SISTEM
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {user.staffId || 'Tiada no. pekerja'} · {user.deptName}
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${STATUS_CLASS[user.status]}`}
        >
          {STATUS_LABEL[user.status]}
        </span>
      </div>

      {user.registrationNote && (
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-700">Catatan pemohon: </span>
          {user.registrationNote}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold text-slate-600">
            {isPending ? 'Peranan diluluskan' : 'Peranan'}
          </span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={isSelf || busy !== null}
            className="w-full border border-slate-300 rounded-lg p-1.5 text-[11px] bg-white disabled:bg-slate-100 disabled:text-slate-500"
          >
            {ROLES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ROLE_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-bold text-slate-600">Bengkel / Makmal</span>
          <select
            value={workshopId}
            onChange={(event) => setWorkshopId(event.target.value)}
            disabled={busy !== null}
            className="w-full border border-slate-300 rounded-lg p-1.5 text-[11px] bg-white disabled:bg-slate-100"
          >
            <option value="">Tiada penugasan</option>
            {workshops.map((workshop) => (
              <option key={workshop.id} value={workshop.id}>
                {workshop.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
          isSystemAdmin ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
        } ${isSelf ? 'opacity-60' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          checked={isSystemAdmin}
          onChange={(event) => setIsSystemAdmin(event.target.checked)}
          disabled={isSelf || busy !== null}
          className="mt-0.5 accent-emerald-700"
        />
        <span className="text-[10px] text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-800 block">Pentadbir Sistem</span>
          Akses penuh di atas peranan fungsi: urus pengguna, data induk, fasiliti dan audit. Tidak
          boleh dimohon melalui pendaftaran.
        </span>
      </label>

      {feedback && (
        <div
          className={`p-2 rounded-lg border text-[11px] flex items-start gap-1.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {showPasswordReset && (
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-600">
            Kata laluan baharu (min 8 aksara, huruf + nombor)
          </span>
          <input
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] bg-white font-mono"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={resetPassword}
              disabled={newPassword.length < 8 || busy !== null}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-md text-[10px] font-bold"
            >
              Set Kata Laluan
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPasswordReset(false);
                setNewPassword('');
              }}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[10px] font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {isPending ? (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={busy !== null}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              {busy === 'approve' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Luluskan
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={busy !== null}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              {busy === 'reject' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserX className="w-3.5 h-3.5" />
              )}
              Tolak
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={save}
              disabled={isSelf || busy !== null}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              {busy === 'save' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Simpan
            </button>
            <button
              type="button"
              onClick={() => setShowPasswordReset((open) => !open)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              Set Kata Laluan
            </button>
            {!isSelf && user.status === 'aktif' && (
              <button
                type="button"
                onClick={deactivate}
                disabled={busy !== null}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                Nyahaktif
              </button>
            )}
            {user.status !== 'aktif' && !isSelf && (
              <button
                type="button"
                onClick={approve}
                disabled={busy !== null}
                className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-[11px] font-semibold"
              >
                Aktifkan semula
              </button>
            )}
          </>
        )}

        <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {user.lastLoginAt
            ? `Log masuk: ${user.lastLoginAt.replace('T', ' ').slice(0, 16)}`
            : 'Belum pernah log masuk'}
        </span>
      </div>
    </div>
  );
};
