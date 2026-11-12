import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  Building,
  BadgeCheck,
  Clock
} from 'lucide-react';
import { REGISTERABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, SYSTEM_ADMIN_DESCRIPTION, SYSTEM_ADMIN_LABEL, type Role } from '../../shared/roles';
import type { UserProfile } from '../types/auth';
import { loginAccount, registerAccount } from '../data/authStorage';
import { usePortalData } from '../hooks/usePortalData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login'
}) => {
  const { departments, workshops } = usePortalData();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    staffId: '',
    role: 'penyelia_bengkel' as Role,
    deptId: departments[0]?.id ?? 'dept-jkm',
    workshopId: '',
    note: '',
    password: '',
    confirmPassword: ''
  });

  if (!isOpen) return null;

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const user = await loginAccount(loginData.identifier, loginData.password);
      onAuthSuccess(user);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal log masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (registerData.password !== registerData.confirmPassword) {
      setErrorMessage('Pengesahan kata laluan tidak sepadan.');
      return;
    }

    setIsLoading(true);
    try {
      const message = await registerAccount({
        fullName: registerData.fullName,
        email: registerData.email,
        staffId: registerData.staffId || undefined,
        role: registerData.role,
        deptId: registerData.deptId,
        workshopId: registerData.workshopId || null,
        note: registerData.note,
        password: registerData.password,
        confirmPassword: registerData.confirmPassword
      });
      setSuccessMessage(message);
      setMode('login');
      setLoginData({ identifier: registerData.email, password: '' });
      setRegisterData((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Pendaftaran gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {mode === 'login' ? 'Log Masuk Portal' : 'Daftar Akaun Baharu'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Akaun baharu perlu diluluskan oleh Pentadbir Sistem
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

        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'login' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Log Masuk
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'register' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Daftar Akaun
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  E-mel atau No. Pekerja
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginData.identifier}
                    onChange={(event) =>
                      setLoginData({ ...loginData, identifier: event.target.value })
                    }
                    placeholder="nama@poliku.edu.my atau PKS-JKM-7601"
                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kata Laluan</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={loginData.password}
                    onChange={(event) =>
                      setLoginData({ ...loginData, password: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Log Masuk
              </button>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  Akaun yang baru didaftarkan tidak boleh log masuk sehingga diluluskan oleh
                  Pentadbir Sistem.
                </span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Penuh *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={registerData.fullName}
                      onChange={(event) =>
                        setRegisterData({ ...registerData, fullName: event.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mel *</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={registerData.email}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, email: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Pekerja</label>
                  <input
                    type="text"
                    value={registerData.staffId}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, staffId: event.target.value })
                    }
                    placeholder="PKS-JKM-0000"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peranan Dimohon *</label>
                  <select
                    value={registerData.role}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, role: event.target.value as Role })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {REGISTERABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Peranan Pentadbir Sistem tidak boleh dimohon di sini — ia diberikan oleh
                    Pentadbir Sistem sedia ada melalui menu <strong>Urus Pengguna</strong>.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan *</label>
                  <select
                    value={registerData.deptId}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, deptId: event.target.value, workshopId: '' })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Bengkel / Makmal / Bilik
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={registerData.workshopId}
                      onChange={(event) =>
                        setRegisterData({ ...registerData, workshopId: event.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">Tiada penugasan</option>
                      {workshops
                        .filter((workshop) => workshop.deptId === registerData.deptId)
                        .map((workshop) => (
                          <option key={workshop.id} value={workshop.id}>
                            {workshop.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Catatan untuk Pentadbir (pilihan)
                  </label>
                  <textarea
                    rows={2}
                    value={registerData.note}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, note: event.target.value })
                    }
                    placeholder="Contoh: Penyelia Makmal CAD/CAM, mula bertugas Jan 2026."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kata Laluan *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={registerData.password}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, password: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sahkan Kata Laluan *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={registerData.confirmPassword}
                    onChange={(event) =>
                      setRegisterData({ ...registerData, confirmPassword: event.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Minimum 8 aksara dan mesti mengandungi huruf serta nombor. Peranan dimohon akan
                disemak oleh Pentadbir Sistem sebelum akaun diaktifkan.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BadgeCheck className="w-4 h-4" />
                )}
                Hantar Permohonan Akaun
              </button>
            </form>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Peranan PBAC
            </div>
            {ROLES.map((role) => (
              <p key={role} className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">{ROLE_LABELS[role]}:</span>{' '}
                {ROLE_DESCRIPTIONS[role]}
              </p>
            ))}
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">{SYSTEM_ADMIN_LABEL}:</span>{' '}
              {SYSTEM_ADMIN_DESCRIPTION}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
