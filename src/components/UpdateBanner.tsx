import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Rocket, X } from 'lucide-react';
import {
  APP_BUILD_ID,
  APP_VERSION,
  fetchRemoteVersion,
  isOutdated,
  reloadWithBuild,
  type RemoteVersion
} from '../services/version';

const POLL_INTERVAL_MS = 60_000;
const COUNTDOWN_SECONDS = 15;
const GUARD_KEY = 'jkm_update_attempt';

interface UpdateBannerProps {
  /** Pause the automatic reload while a request is in flight. */
  hold?: boolean;
  /** Disable polling (used for local development). */
  disabled?: boolean;
}

/**
 * Detects a newer Cloudflare deployment by polling /api/version and reloads the
 * tab automatically so every officer runs the same build.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({ hold = false, disabled = false }) => {
  const [remote, setRemote] = useState<RemoteVersion | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const autoReloadBlocked = useRef(false);

  const check = useCallback(async () => {
    const latest = await fetchRemoteVersion();
    if (!latest) return;
    if (!isOutdated(latest)) {
      setRemote(null);
      setSecondsLeft(null);
      setDismissed(false);
      autoReloadBlocked.current = false;
      try {
        sessionStorage.removeItem(GUARD_KEY);
      } catch {
        // ignore
      }
      return;
    }
    setRemote(latest);
  }, []);

  useEffect(() => {
    if (disabled) return;

    try {
      // If we already forced a reload for this build and still see it, avoid a loop.
      autoReloadBlocked.current = sessionStorage.getItem(GUARD_KEY) === APP_BUILD_ID;
    } catch {
      autoReloadBlocked.current = false;
    }

    void check();

    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onFocus = () => void check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [check, disabled]);

  useEffect(() => {
    if (!remote || dismissed || autoReloadBlocked.current) {
      setSecondsLeft(null);
      return;
    }

    setSecondsLeft((current) => current ?? COUNTDOWN_SECONDS);
  }, [remote, dismissed]);

  useEffect(() => {
    if (secondsLeft === null || !remote) return;
    if (hold) return;

    if (secondsLeft <= 0) {
      try {
        sessionStorage.setItem(GUARD_KEY, APP_BUILD_ID);
      } catch {
        // ignore
      }
      reloadWithBuild(remote.buildId, { endSession: true }).catch(() => window.location.reload());
      return;
    }

    const timer = window.setTimeout(() => setSecondsLeft((value) => (value ?? 1) - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, remote, hold]);

  if (!remote || dismissed) return null;

  const handleReload = () => {
    try {
      sessionStorage.setItem(GUARD_KEY, APP_BUILD_ID);
    } catch {
      // ignore
    }
    reloadWithBuild(remote.buildId, { endSession: true }).catch(() => window.location.reload());
  };

  const waiting = hold && secondsLeft !== null;

  return (
    <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-60 w-[min(94vw,32rem)]">
      <div className="rounded-2xl border border-emerald-300 bg-white shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Rocket className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-bold text-slate-900">Versi baharu tersedia</div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Portal telah dikemas kini ke <span className="font-mono font-semibold">v{remote.version}</span>{' '}
              (anda menggunakan <span className="font-mono">v{APP_VERSION}</span>).
              {waiting
                ? ' Halaman akan dimuat semula selepas proses semasa selesai.'
                : secondsLeft !== null
                  ? ` Halaman akan dimuat semula dalam ${secondsLeft} saat dan anda perlu log masuk semula.`
                  : ' Klik muat semula untuk menggunakan versi terkini (log masuk semula diperlukan).'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Muat semula sekarang
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
              >
                Nanti
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-700 p-1"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
