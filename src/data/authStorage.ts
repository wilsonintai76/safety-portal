/**
 * Session lifecycle — the Worker + D1/KV are the single source of truth.
 *
 * No profile is persisted in the browser: every boot renders a short
 * "memulihkan sesi" splash and reconciles against `/api/me`. Drafts and UI
 * preferences live in localStorage, but identity and permissions never do.
 */
import type { UserProfile } from '../types/auth';
import {
  fetchSession,
  loginWithPassword,
  registerAccount as registerAccountRequest,
  signOut,
  type RegisterPayload
} from '../services/portalApi';

const LEGACY_SESSION_KEY = 'jkm_session_cache_v1';

/** Removes the profile snapshot written by older builds. */
export function clearLegacySessionCache(): void {
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage disabled: nothing to clean.
  }
}

/** Reconciles the UI with the server session. */
export async function refreshSession(): Promise<UserProfile | null> {
  clearLegacySessionCache();
  try {
    return await fetchSession();
  } catch {
    return null;
  }
}

export async function loginAccount(identifier: string, password: string): Promise<UserProfile> {
  const result = await loginWithPassword(identifier, password);
  return result.user;
}

export async function registerAccount(payload: RegisterPayload): Promise<string> {
  return registerAccountRequest(payload);
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut();
  } finally {
    clearLegacySessionCache();
  }
}

