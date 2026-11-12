/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header, ActiveTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MultiStepHirarcForm } from './components/MultiStepHirarcForm';
import { ChecklistForm } from './components/ChecklistForm';
import { DashboardView } from './components/DashboardView';
import { RecordsView } from './components/RecordsView';
import { MatrixModal } from './components/MatrixModal';
import { PrintDocument } from './components/PrintDocument';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import {
  HirarcData,
  ChecklistData,
  UploadedFile,
  SavedReport
} from './types/safety';
import { UserProfile } from './types/auth';
import { CloudflareModal } from './components/CloudflareModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { UserManagementModal } from './components/UserManagementModal';
import { WorkshopManagementModal } from './components/WorkshopManagementModal';
import { exportReportToPdf } from './utils/pdfExport';
import { INITIAL_CHECKLIST_SECTIONS, getRiskLevel } from './data/presets';
import { LandingPageView } from './components/LandingPageView';
import { UpdateBanner } from './components/UpdateBanner';
import { APP_VERSION } from './services/version';
import { refreshSession, signOutUser } from './data/authStorage';
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  reviewDocument,
  type ReviewDecisionInput
} from './services/portalApi';
import { CheckCircle2, AlertCircle, X, Loader2, ShieldCheck } from 'lucide-react';

export default function App() {
  // The server session is the only source of truth: the UI waits for /api/me
  // behind a short splash instead of trusting a browser-cached profile.
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('LANDING');
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [isCloudflareModalOpen, setIsCloudflareModalOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isWorkshopManagementOpen, setIsWorkshopManagementOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jkm_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('jkm_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Print state
  const [printConfig, setPrintConfig] = useState<{
    active: boolean;
    mode: 'HIRARC' | 'L2B';
    isBlank: boolean;
    hirarcData?: HirarcData;
    checklistData?: ChecklistData;
  }>({
    active: false,
    mode: 'HIRARC',
    isBlank: false
  });

  // Toast Status Notification
  const [statusNotification, setStatusNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reports collection
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    let cancelled = false;

    refreshSession().then((user) => {
      if (cancelled) return;
      setCurrentUser(user);
      setIsSessionReady(true);
      if (!user) {
        // No valid server session: show the public landing page.
        setActiveTab('LANDING');
        return;
      }
      // Session restored from cookie: resume on the dashboard, but never pull the
      // user out of a view they already opened while the check was in flight.
      setActiveTab((tab) => (tab === 'LANDING' ? 'DASHBOARD' : tab));
      // Seed empty forms with the signed-in officer's details.
      setHirarcData((prev) => ({
        ...prev,
        preparedBy: prev.preparedBy || user.name,
        location: prev.location || (user.workshopLocation ?? '')
      }));
      setChecklistData((prev) => ({
        ...prev,
        nama: prev.nama || user.name,
        lokasi: prev.lokasi || (user.workshopLocation ?? '')
      }));
      fetchDocuments()
        .then((items) => {
          if (!cancelled) setReports(items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setStatusNotification({
            type: 'error',
            message:
              error instanceof Error
                ? `Gagal memuatkan dokumen dari D1: ${error.message}`
                : 'Gagal memuatkan dokumen dari D1.'
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshReports = () => {
    if (!currentUser) {
      setReports([]);
      return;
    }
    fetchDocuments()
      .then(setReports)
      .catch((error: unknown) => {
        setStatusNotification({
          type: 'error',
          message:
            error instanceof Error
              ? `Gagal menyegarkan senarai dokumen: ${error.message}`
              : 'Gagal menyegarkan senarai dokumen.'
        });
      });
  };

  const AUTOSAVE_HIRARC_KEY = 'jkm_autosave_hirarc_v1';
  const AUTOSAVE_CHECKLIST_KEY = 'jkm_autosave_checklist_v1';

  /**
   * Drafts are browser-only work-in-progress copies (D1 stays the single source
   * of truth) and are tagged with their owner so a shared browser cannot show
   * one officer's unsent draft to another. They are only adopted once /api/me
   * confirms who is signed in.
   */
  const readDraft = <T,>(key: string, ownerId: string | null): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data?: T; ownerId?: string | null };
      if (!parsed?.data) return null;
      if (parsed.ownerId && parsed.ownerId !== ownerId) return null;
      return parsed.data;
    } catch (error) {
      console.error('Failed to parse auto-save draft:', error);
      return null;
    }
  };

  const [lastHirarcAutoSave, setLastHirarcAutoSave] = useState<string | null>(null);
  const [lastChecklistAutoSave, setLastChecklistAutoSave] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const emptyHirarcRow = (suffix: string) => ({
    id: `row-init-${suffix}`,
    rnr: 'R' as const,
    workActivity: '',
    hazard: '',
    effect: '',
    existingControl: '',
    l: 2,
    s: 2,
    recommendedControl: '',
    pic: '',
    dueDate: '',
    status: 'Belum Selesai' as const
  });

  const emptyHirarcData = (suffix: string): HirarcData => ({
    hirNo: '',
    title: '',
    dept: 'JABATAN KEJURUTERAAN MEKANIKAL (JKM)',
    location: currentUser?.workshopLocation || '',
    preparedBy: currentUser?.name || '',
    date: today,
    rows: [emptyHirarcRow(suffix)]
  });

  // Initial HIRARC state (Checks localStorage auto-save draft first)

  const [hirarcData, setHirarcData] = useState<HirarcData>(() => emptyHirarcData('initial'));

  const [hirarcFiles, setHirarcFiles] = useState<UploadedFile[]>([]);

  // Initial Checklist state (draft adopted once the session is confirmed)
  const [checklistData, setChecklistData] = useState<ChecklistData>(() => {
    const flatItems: ChecklistData['items'] = [];
    INITIAL_CHECKLIST_SECTIONS.forEach((sec) => {
      sec.items.forEach((itemText, iIdx) => {
        flatItems.push({
          id: `item-${sec.seksyen}-${iIdx}`,
          seksyen: sec.seksyen,
          item: itemText,
          jawapan: iIdx % 3 === 0 ? 'Ya' : 'Ya',
          catatan: ''
        });
      });
    });

    return {
      nama: currentUser?.name || '',
      lokasi: currentUser?.workshopLocation || '',
      tarikh: today,
      items: flatItems
    };
  });

  // Latest form state for the autosave writer (avoids restarting the timer on every keystroke).
  const draftRef = useRef({ hirarcData, checklistData, userId: currentUser?.id ?? null });
  draftRef.current = { hirarcData, checklistData, userId: currentUser?.id ?? null };

  // A draft belongs to the signed-in officer: adopt it once /api/me resolves,
  // never overwriting work already typed.
  const draftHydratedRef = useRef(false);
  useEffect(() => {
    if (draftHydratedRef.current || !currentUser) return;
    draftHydratedRef.current = true;

    const hirarcDraft = readDraft<HirarcData>(AUTOSAVE_HIRARC_KEY, currentUser.id);
    if (hirarcDraft) {
      setHirarcData((prev) =>
        prev.title || prev.rows.some((row) => row.workActivity || row.hazard) ? prev : hirarcDraft
      );
    }

    const checklistDraft = readDraft<ChecklistData>(AUTOSAVE_CHECKLIST_KEY, currentUser.id);
    if (checklistDraft) {
      setChecklistData((prev) =>
        prev.items.some((item) => item.catatan.trim()) ? prev : checklistDraft
      );
    }
  }, [currentUser]);

  const persistDrafts = useCallback(() => {
    const nowStr = new Date().toLocaleTimeString('ms-MY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const latest = draftRef.current;

    const saveDraft = (key: string, data: unknown) => {
      try {
        if (!latest.userId) {
          // Never clobber a signed-in officer's draft while anonymous (e.g. a
          // reload that happened before /api/me resolved).
          const existing = localStorage.getItem(key);
          if (existing && JSON.parse(existing)?.ownerId) return;
        }
        localStorage.setItem(
          key,
          JSON.stringify({ data, savedAt: nowStr, ownerId: latest.userId })
        );
      } catch (err) {
        console.error(`Error auto-saving ${key}:`, err);
      }
    };

    saveDraft(AUTOSAVE_HIRARC_KEY, latest.hirarcData);
    setLastHirarcAutoSave(nowStr);
    saveDraft(AUTOSAVE_CHECKLIST_KEY, latest.checklistData);
    setLastChecklistAutoSave(nowStr);
  }, []);

  // 30-second auto-save, plus a final flush before the tab unloads (e.g. when an
  // update is deployed and the page reloads itself).
  useEffect(() => {
    const timer = window.setInterval(persistDrafts, 30000);
    const flush = () => persistDrafts();

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [persistDrafts]);

  const handleResetHirarcDraft = () => {
    localStorage.removeItem(AUTOSAVE_HIRARC_KEY);
    setLastHirarcAutoSave(null);
    setHirarcData(emptyHirarcData(`${Date.now()}`));
    setStatusNotification({
      type: 'success',
      message: 'Draf HIRARC telah direset. Borang baru disediakan.'
    });
  };

  const handleResetChecklistDraft = () => {
    localStorage.removeItem(AUTOSAVE_CHECKLIST_KEY);
    setLastChecklistAutoSave(null);
    const flatItems: ChecklistData['items'] = [];
    INITIAL_CHECKLIST_SECTIONS.forEach((sec) => {
      sec.items.forEach((itemText, iIdx) => {
        flatItems.push({
          id: `item-${sec.seksyen}-${iIdx}-${Date.now()}`,
          seksyen: sec.seksyen,
          item: itemText,
          jawapan: 'Ya',
          catatan: ''
        });
      });
    });
    setChecklistData({
      nama: currentUser?.name || '',
      lokasi: currentUser?.workshopLocation || '',
      tarikh: today,
      items: flatItems
    });
    setStatusNotification({
      type: 'success',
      message: 'Draf Senarai Semak L2B telah direset. Borang baru disediakan.'
    });
  };

  // Keep form user defaults synchronized when user logs in or switches
  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab('DASHBOARD');
    setHirarcData((prev) => ({
      ...prev,
      preparedBy: user.name,
      location: user.workshopLocation || prev.location
    }));
    setChecklistData((prev) => ({
      ...prev,
      nama: user.name,
      lokasi: user.workshopLocation || prev.lokasi
    }));
    fetchDocuments()
      .then(setReports)
      .catch((error: unknown) => {
        setStatusNotification({
          type: 'error',
          message:
            error instanceof Error
              ? `Gagal memuatkan dokumen: ${error.message}`
              : 'Gagal memuatkan dokumen dari D1.'
        });
      });
    setStatusNotification({
      type: 'success',
      message: `Log masuk berjaya! Selamat datang ${user.name}.`
    });
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setActiveTab('LANDING');
    setIsProfileModalOpen(false);
    setReports([]);
    // Clear autosave drafts so stale data doesn't persist across sessions
    try {
      localStorage.removeItem(AUTOSAVE_HIRARC_KEY);
      localStorage.removeItem(AUTOSAVE_CHECKLIST_KEY);
    } catch {}
    setLastHirarcAutoSave(null);
    setLastChecklistAutoSave(null);
    setStatusNotification({
      type: 'success',
      message: 'Anda telah berjaya log keluar dari Portal Keselamatan JKM.'
    });
  };

  const handleUserUpdated = (updated: UserProfile) => {
    setCurrentUser(updated);
    setHirarcData((prev) => ({
      ...prev,
      preparedBy: updated.name,
      location: updated.workshopLocation || prev.location
    }));
    setChecklistData((prev) => ({
      ...prev,
      nama: updated.name,
      lokasi: updated.workshopLocation || prev.lokasi
    }));
  };

  // Handle Printing
  const handlePrint = (
    mode: 'HIRARC' | 'L2B',
    isBlank: boolean,
    customHirarc?: HirarcData,
    customChecklist?: ChecklistData
  ) => {
    setPrintConfig({
      active: true,
      mode,
      isBlank,
      hirarcData: customHirarc || hirarcData,
      checklistData: customChecklist || checklistData
    });

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Export PDF Handler for any saved report
  const handleDirectPdfExport = async (report: SavedReport) => {
    setStatusNotification({
      type: 'success',
      message: `Menjana fail PDF untuk "${report.titleOrLocation}"... Sila tunggu sebentar.`
    });

    setPrintConfig({
      active: true,
      mode: report.jenis === 'HIRARC' ? 'HIRARC' : 'L2B',
      isBlank: false,
      hirarcData: report.hirarc,
      checklistData: report.checklist
    });

    // Wait for PrintDocument to render in DOM
    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await exportReportToPdf(
      'print-root',
      report.jenis === 'HIRARC' ? 'HIRARC' : 'L2B',
      report.titleOrLocation,
      {
        onProgress: (stage) => {
          setStatusNotification({ type: 'success', message: stage });
        }
      }
    );

    if (result.success) {
      setStatusNotification({
        type: 'success',
        message: 'PDF berjaya dijana dan dimuat turun ke peranti.'
      });
    } else {
      setStatusNotification({
        type: 'error',
        message: `Gagal mengeksport PDF: ${result.error}`
      });
    }
  };

  const handleExportCurrentHirarcPdf = async () => {
    setPrintConfig({
      active: true,
      mode: 'HIRARC',
      isBlank: false,
      hirarcData
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const result = await exportReportToPdf('print-root', 'HIRARC', hirarcData.title || 'HIRARC_Semasa');
    if (result.success) {
      setStatusNotification({
        type: 'success',
        message: 'Borang HIRARC semasa berjaya dieksport ke PDF & disandarkan ke Cloudflare R2!'
      });
    }
  };

  const handleExportCurrentChecklistPdf = async () => {
    setPrintConfig({
      active: true,
      mode: 'L2B',
      isBlank: false,
      checklistData
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const result = await exportReportToPdf('print-root', 'L2B', checklistData.lokasi || 'Checklist_Semasa');
    if (result.success) {
      setStatusNotification({
        type: 'success',
        message: 'Senarai Semak (Lampiran 2B) berjaya dieksport ke PDF & disandarkan ke Cloudflare R2!'
      });
    }
  };

  // Handle HIRARC Submission
  const handleSubmitHirarc = async () => {
    if (!hirarcData.title || !hirarcData.preparedBy || !hirarcData.date) {
      setStatusNotification({
        type: 'error',
        message: 'Sila lengkapkan Title, Prepared By dan Tarikh borang HIRARC.'
      });
      return;
    }

    if (hirarcData.rows.length === 0) {
      setStatusNotification({
        type: 'error',
        message: 'Sekurang-kurangnya satu baris hazard diperlukan.'
      });
      return;
    }

    setIsSubmitting(true);
    setStatusNotification(null);

    // Calculate max risk
    let maxRisk = 0;
    hirarcData.rows.forEach((r) => {
      const s = Number(r.l) * Number(r.s);
      if (s > maxRisk) maxRisk = s;
    });

    const riskLevelObj = getRiskLevel(maxRisk);
    const now = new Date();
    const id = `HIR-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;


    try {
      const { document, attachmentErrors } = await createDocument(
        { jenis: 'HIRARC', submit: true, hirarc: { ...hirarcData } },
        hirarcFiles
      );
      setHirarcFiles([]);
      refreshReports();

      localStorage.removeItem(AUTOSAVE_HIRARC_KEY);
      setLastHirarcAutoSave(null);

      setStatusNotification({
        type: 'success',
        message: `Laporan HIRARC ${document.docNo ?? id} disimpan ke D1${
          attachmentErrors.length > 0
            ? ` (${attachmentErrors.length} lampiran gagal dimuat naik ke R2)`
            : ' beserta lampiran R2'
        }. Status: Menunggu Semakan.`
      });
    } catch (error) {
      setStatusNotification({
        type: 'error',
        message: `Gagal menyimpan ke D1: ${
          error instanceof Error ? error.message : 'ralat tidak diketahui'
        }. Draf anda masih tersimpan secara automatik.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Checklist Submission
  const handleSubmitChecklist = async () => {
    if (!checklistData.nama || !checklistData.lokasi || !checklistData.tarikh) {
      setStatusNotification({
        type: 'error',
        message: 'Sila lengkapkan Nama Pemeriksa, Lokasi dan Tarikh Pemeriksaan.'
      });
      return;
    }

    setIsSubmitting(true);
    setStatusNotification(null);

    let ya = 0;
    let tidak = 0;
    let na = 0;

    checklistData.items.forEach((it) => {
      if (it.jawapan === 'Ya') ya++;
      else if (it.jawapan === 'Tidak') tidak++;
      else if (it.jawapan === 'NA') na++;
    });

    const totalEvaluated = ya + tidak;
    const complianceRate = totalEvaluated > 0 ? Math.round((ya / totalEvaluated) * 100) : 100;

    const now = new Date();
    const id = `L2B-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;


    try {
      const { document } = await createDocument({
        jenis: 'L2B',
        submit: true,
        checklist: { ...checklistData }
      });
      refreshReports();

      localStorage.removeItem(AUTOSAVE_CHECKLIST_KEY);
      setLastChecklistAutoSave(null);

      setStatusNotification({
        type: 'success',
        message: `Laporan Pemeriksaan ${document.docNo ?? id} disimpan ke D1. Status: Menunggu Semakan.`
      });
    } catch (error) {
      setStatusNotification({
        type: 'error',
        message: `Gagal menyimpan ke D1: ${
          error instanceof Error ? error.message : 'ralat tidak diketahui'
        }. Draf anda masih tersimpan secara automatik.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewReport = async (
    report: SavedReport,
    decision: ReviewDecisionInput['decision'],
    note: string
  ) => {
    setIsSubmitting(true);
    try {
      const updated = await reviewDocument(report.id, { decision, note });
      setReports((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      );
      setStatusNotification({
        type: 'success',
        message: `Dokumen ${updated.docNo ?? updated.id} dikemas kini: ${
          decision === 'lulus' ? 'Diluluskan' : decision === 'tolak' ? 'Ditolak' : 'Disemak'
        }.`
      });
    } catch (error) {
      setStatusNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Gagal mengemas kini status dokumen.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteDocument(id);
      refreshReports();
      setStatusNotification({
        type: 'success',
        message: 'Dokumen dan lampiran R2 telah dipadam.'
      });
    } catch (error) {
      setStatusNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Gagal memadam dokumen.'
      });
    }
  };

  if (!isSessionReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100 text-slate-700">
        <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-lg">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Memulihkan sesi anda…</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Portal Keselamatan JKM · menyemak sesi dengan Cloudflare
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800">
      {/* 1. Desktop Sidebar Navigation (Only on internal views, hidden on mobile/tablet < lg) */}
      {activeTab !== 'LANDING' && (
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          currentUser={currentUser}
          onOpenMatrix={() => setIsMatrixOpen(true)}
          onOpenCloudflare={() => setIsCloudflareModalOpen(true)}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
          onOpenWorkshopManagement={() => setIsWorkshopManagementOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenAuth={() => {
            setAuthMode('login');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onOpenMatrix={() => setIsMatrixOpen(true)}
          currentUser={currentUser}
          onOpenAuth={() => {
            setAuthMode('login');
            setIsAuthModalOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenCloudflare={() => setIsCloudflareModalOpen(true)}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
          onOpenWorkshopManagement={() => setIsWorkshopManagementOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Floating Status Notification Toast */}
        {statusNotification && (
          <div className="no-print max-w-7xl mx-auto px-4 sm:px-6 pt-4 w-full">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-xs transition-all ${
                statusNotification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                  : 'bg-red-50 text-red-950 border-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusNotification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{statusNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusNotification(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Main Content Layout */}
        <main className="no-print flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8">
        {activeTab === 'LANDING' && (
          <LandingPageView
            currentUser={currentUser}
            onLoginSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenMatrix={() => setIsMatrixOpen(true)}
            onOpenCloudflare={() => setIsCloudflareModalOpen(true)}
            onOpenAuth={(mode = 'login') => {
              setAuthMode(mode);
              setIsAuthModalOpen(true);
            }}
            onStartInspection={(tab, workshop) => {
              if (tab === 'HIRARC') {
                setHirarcData((prev) => ({
                  ...prev,
                  location: workshop,
                  title: `PENILAIAN RISIKO KESELAMATAN ${workshop}`
                }));
                setActiveTab('HIRARC');
              } else {
                setChecklistData((prev) => ({
                  ...prev,
                  lokasi: workshop
                }));
                setActiveTab('CHECKLIST');
              }
            }}
          />
        )}

        {activeTab === 'DASHBOARD' && (
          <DashboardView
            reports={reports}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenMatrix={() => setIsMatrixOpen(true)}
            onPrintReport={(rep) => {
              if (rep.jenis === 'HIRARC' && rep.hirarc) {
                handlePrint('HIRARC', false, rep.hirarc);
              } else if (rep.checklist) {
                handlePrint('L2B', false, undefined, rep.checklist);
              }
            }}
            onPrintBlank={(mode) => handlePrint(mode, true)}
            onExportPdfDirect={handleDirectPdfExport}
            currentUser={currentUser}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenCloudflare={() => setIsCloudflareModalOpen(true)}
            onStartInspection={(tab, workshop) => {
              if (tab === 'HIRARC') {
                setHirarcData((prev) => ({
                  ...prev,
                  location: workshop,
                  title: `PENILAIAN RISIKO KESELAMATAN ${workshop}`
                }));
                setActiveTab('HIRARC');
              } else {
                setChecklistData((prev) => ({
                  ...prev,
                  lokasi: workshop
                }));
                setActiveTab('CHECKLIST');
              }
            }}
          />
        )}

        {activeTab === 'HIRARC' && (
          <MultiStepHirarcForm
            data={hirarcData}
            onChange={setHirarcData}
            files={hirarcFiles}
            onFilesChange={setHirarcFiles}
            onOpenMatrix={() => setIsMatrixOpen(true)}
            onPrint={(isBlank) => handlePrint('HIRARC', isBlank)}
            onExportPdf={handleExportCurrentHirarcPdf}
            onSubmit={handleSubmitHirarc}
            isSubmitting={isSubmitting}
            lastAutoSaveTime={lastHirarcAutoSave}
            onResetDraft={handleResetHirarcDraft}
            onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          />
        )}

        {activeTab === 'CHECKLIST' && (
          <ChecklistForm
            data={checklistData}
            onChange={setChecklistData}
            onSubmit={handleSubmitChecklist}
            onPrint={(isBlank) => handlePrint('L2B', isBlank)}
            onExportPdf={handleExportCurrentChecklistPdf}
            isSubmitting={isSubmitting}
            lastAutoSaveTime={lastChecklistAutoSave}
            onResetDraft={handleResetChecklistDraft}
          />
        )}

        {activeTab === 'RECORDS' && (
          <RecordsView
            reports={reports}
            onRefreshReports={refreshReports}
            onPrintReport={(rep) => {
              if (rep.jenis === 'HIRARC' && rep.hirarc) {
                handlePrint('HIRARC', false, rep.hirarc);
              } else if (rep.checklist) {
                handlePrint('L2B', false, undefined, rep.checklist);
              }
            }}
            onExportPdfDirect={handleDirectPdfExport}
            currentUser={currentUser}
            onReviewReport={handleReviewReport}
            onDeleteReport={handleDeleteReport}
            onSelectReportToEdit={(rep) => {
              if (rep.jenis === 'HIRARC' && rep.hirarc) {
                setHirarcData(rep.hirarc);
                setActiveTab('HIRARC');
              } else if (rep.checklist) {
                setChecklistData(rep.checklist);
                setActiveTab('CHECKLIST');
              }
            }}
          />
        )}
      </main>

      {/* 3. Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-auto py-5 text-center text-xs text-slate-500 pb-20 lg:pb-5">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-left">
            <span className="font-bold text-slate-800">Jabatan Kejuruteraan Mekanikal (JKM)</span>
            <span className="hidden sm:inline"> · Sistem Pengurusan Keselamatan Bengkel PK-06(1)(01-07-22)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Akta Keselamatan & Kesihatan Pekerjaan 1994 (OSHA 1994)</span>
            <span>·</span>
            <span>Garis Panduan JKKP 2008</span>
            <span>·</span>
            <span className="font-mono">v{APP_VERSION}</span>
          </div>
        </div>
      </footer>
      </div>

      <UpdateBanner hold={isSubmitting} disabled={!import.meta.env.PROD && import.meta.env.VITE_ENABLE_UPDATE_CHECK !== 'true'} />

      {/* Modals */}
      <MatrixModal
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
        onSelectCoordinates={(l, s) => {
          setIsMatrixOpen(false);
        }}
      />

      {/* Cloudflare D1 / KV / R2 Edge Service Modal */}
      <CloudflareModal
        isOpen={isCloudflareModalOpen}
        onClose={() => setIsCloudflareModalOpen(false)}
        currentUser={currentUser}
      />

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUser={currentUser}
      />

      {/* Workshop Management Modal - Admin only */}
      <WorkshopManagementModal
        isOpen={isWorkshopManagementOpen}
        onClose={() => setIsWorkshopManagementOpen(false)}
        currentUser={currentUser}
      />

      {/* AI provider settings: Workers AI by default, BYOK optional */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        onSaved={() =>
          setStatusNotification({
            type: 'success',
            message: 'Tetapan AI dikemas kini. Cadangan kawalan akan menggunakan penyedia pilihan anda.'
          })
        }
      />

      {/* User Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      {/* User Profile Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onUserUpdated={handleUserUpdated}
          onLogout={handleLogout}
        />
      )}

      {/* Hidden Print Document (Rendered only on print) */}
      <PrintDocument
        mode={printConfig.mode}
        isBlank={printConfig.isBlank}
        hirarcData={printConfig.hirarcData}
        checklistData={printConfig.checklistData}
      />
    </div>
  );
}
