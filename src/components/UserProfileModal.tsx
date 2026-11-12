import React, { useState } from 'react';
import { X, User, Mail, Building, Briefcase, Calendar, LogOut, Check, Save } from 'lucide-react';
import { roleLabel } from '../../shared/roles';
import { UserProfile } from '../types/auth';
import { usePortalData } from '../hooks/usePortalData';
import { changeMyPassword, updateMyProfile } from '../services/portalApi';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onLogout
}) => {
  const { workshopNames } = usePortalData();
  const [name, setName] = useState(currentUser.name);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordState, setPasswordState] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSaving(true);
    try {
      const updated = await updateMyProfile(name.trim().toUpperCase());
      onUserUpdated(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Gagal menyimpan profil ke pelayan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordState(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordState({ type: 'error', message: 'Pengesahan kata laluan baharu tidak sepadan.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeMyPassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordState({ type: 'success', message: 'Kata laluan berjaya ditukar.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Gagal menukar kata laluan.'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">
                Profil Pengguna JKM
              </h3>
              <p className="text-[11px] text-slate-500">{roleLabel(currentUser.role, currentUser.isSystemAdmin)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Profil berjaya dikemas kini!</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              {errorMessage}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Penuh
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  No. Pekerja / Matrik
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser.staffId}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-100 font-mono text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kaedah Pengesahan
                </label>
                <div className="border border-slate-200 rounded-lg p-2 text-xs bg-slate-100 font-medium text-slate-600 uppercase">
                  Kata Laluan
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Alamat E-mel
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs bg-slate-100 text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Bengkel / Makmal Bertugas
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={currentUser.workshopLocation}
                  disabled
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
                >
                  {!currentUser.workshopId && <option value="">Tiada penugasan</option>}
                  {workshopNames.map((ws, i) => (
                    <option key={i} value={ws}>
                      {ws}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Penugasan bengkel ditetapkan oleh Pentadbir Sistem melalui kawalan PBAC.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div><strong>Jabatan:</strong> {currentUser.department}</div>
              <div><strong>Tarikh Daftar:</strong> {currentUser.createdAt.slice(0, 10)}</div>
              <div>
                <strong>Log Masuk Terakhir:</strong>{' '}
                {currentUser.lastLoginAt
                  ? currentUser.lastLoginAt.replace('T', ' ').slice(0, 16)
                  : 'Belum log masuk'}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="font-bold text-slate-800">Tukar Kata Laluan</div>
              {passwordState && (
                <div
                  className={`p-2 rounded-lg border text-[11px] ${
                    passwordState.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {passwordState.message}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Kata laluan semasa"
                  value={passwordData.currentPassword}
                  onChange={(event) =>
                    setPasswordData({ ...passwordData, currentPassword: event.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Kata laluan baharu"
                    value={passwordData.newPassword}
                    onChange={(event) =>
                      setPasswordData({ ...passwordData, newPassword: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Sahkan kata laluan"
                    value={passwordData.confirmPassword}
                    onChange={(event) =>
                      setPasswordData({ ...passwordData, confirmPassword: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={
                  isChangingPassword ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword
                }
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5"
              >
                {isChangingPassword ? 'Menukar...' : 'Tukar Kata Laluan'}
              </button>
              <p className="text-[10px] text-slate-500">
                Minimum 8 aksara, mesti mengandungi huruf dan nombor.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="px-3.5 py-2 text-red-700 hover:bg-red-50 border border-red-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Keluar</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

