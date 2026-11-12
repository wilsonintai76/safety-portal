import versionInfo from '../../version.json';
import { API_BASE } from './api';

export const APP_VERSION = versionInfo.version;
export const APP_BUILD_ID = versionInfo.buildId;
export const APP_BUILT_AT = versionInfo.builtAt;

export interface RemoteVersion {
  version: string;
  buildId: string;
  builtAt: string;
}

/** True when the running bundle differs from the deployed Worker build. */
export function isOutdated(remote: RemoteVersion | null): boolean {
  return Boolean(remote?.buildId) && remote!.buildId !== APP_BUILD_ID;
}

export async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const response = await fetch(`${API_BASE}/version`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<RemoteVersion>;
    if (!data.version || !data.buildId) return null;
    return {
      version: data.version,
      buildId: data.buildId,
      builtAt: data.builtAt ?? ''
    };
  } catch {
    return null;
  }
}

/** Reloads with a cache-busting query so stale HTML cannot be served. */
export function buildReloadUrl(buildId: string): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('v', buildId);
    return url.toString();
  } catch {
    return window.location.href;
  }
}

/**
 * Drops browser-side caches before loading a new build:
 * - Cache API entries (populated by any future service worker / asset cache)
 * - the ephemeral bearer token in sessionStorage
 * - the legacy profile snapshot written by older builds
 *
 * Drafts and UI preferences are intentionally kept — they are user work, not
 * cache — but the session itself is ended so the new build starts clean.
 */
export async function purgeClientCaches(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache API unavailable (private mode): nothing to purge.
  }

  try {
    sessionStorage.removeItem('jkm_api_token');
    localStorage.removeItem('jkm_session_cache_v1');
  } catch {
    // Storage disabled: the cookie session still works.
  }
}

/** Ends the server session (KV + cookie) before a forced re-login. */
async function endServerSession(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store'
    });
  } catch {
    // Offline: the local purge below still removes every client credential.
  }
}

/**
 * Purges caches and, when the deployment requires it, ends the session so the
 * new build is loaded without stale credentials.
 */
export async function reloadWithBuild(
  buildId: string,
  options: { endSession?: boolean } = {}
): Promise<void> {
  if (options.endSession) await endServerSession();
  await purgeClientCaches();
  window.location.replace(buildReloadUrl(buildId));
}
