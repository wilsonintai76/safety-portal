import { hc } from 'hono/client';
import type { AppType } from '../../worker/src/index';

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
export const API_TOKEN_KEY = 'jkm_api_token';

export function getStoredApiToken(): string | null {
  try {
    return sessionStorage.getItem(API_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredApiToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(API_TOKEN_KEY, token);
    else sessionStorage.removeItem(API_TOKEN_KEY);
  } catch {
    // Storage can be unavailable in private mode; the HttpOnly cookie still works.
  }
}

const API_ORIGIN =
  typeof window === 'undefined' ? API_BASE : new URL(API_BASE, window.location.origin).origin;

export const api = hc<AppType>(API_ORIGIN, {
  init: { credentials: 'include' },
  headers: () => {
    const headers: Record<string, string> = {};
    const token = getStoredApiToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }
});

export function apiErrorMessage(payload: unknown, fallback = 'Ralat tidak diketahui.'): string {
  const body = payload as {
    error?: string | { issues?: Array<{ message?: string }> };
    code?: string;
  };
  if (typeof body?.error === 'string') return body.error;
  const issue = body?.error?.issues?.[0]?.message;
  return issue || fallback;
}

export async function readApiError(response: {
  status: number;
  text: () => Promise<string>;
}): Promise<string> {
  const text = await response.text();
  if (!text) return `Ralat pelayan (${response.status}).`;
  try {
    return apiErrorMessage(JSON.parse(text), `Ralat pelayan (${response.status}).`);
  } catch {
    return `Ralat pelayan (${response.status}).`;
  }
}
