import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { effectivePermissions } from '../../../shared/roles';
import type { AppEnv, AuthUser, Bindings, SessionUser, UserStatus } from '../types';
import type { RegisterInput } from '../schemas';
import { HttpError } from './http';

export const SESSION_COOKIE = 'jkm_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_ITERATIONS = 100_000;
const MIN_ITERATIONS = 50_000;

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  staff_id: string | null;
  role: SessionUser['role'];
  is_system_admin: number | null;
  dept_id: string;
  workshop_id: string | null;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
  last_login_at: string | null;
  dept_name: string;
  workshop_name: string | null;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function iterationsFor(env: Bindings): number {
  const raw = Number.parseInt(env.PASSWORD_ITERATIONS ?? '', 10);
  return Number.isFinite(raw) && raw >= MIN_ITERATIONS ? raw : DEFAULT_ITERATIONS;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Constant-time comparison so verification timing does not leak hash bytes. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
}

export async function hashPassword(env: Bindings, password: string): Promise<string> {
  const iterations = iterationsFor(env);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  env: Bindings,
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < MIN_ITERATIONS) return false;
  const expected = fromBase64(parts[3]);
  const actual = await pbkdf2(password, fromBase64(parts[2]), iterations);
  return timingSafeEqual(actual, expected);
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, 'Kata laluan mestilah sekurang-kurangnya 8 aksara.', 'weak_password');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new HttpError(
      400,
      'Kata laluan mesti mengandungi huruf dan nombor.',
      'weak_password'
    );
  }
}

function assertEmailDomain(env: Bindings, email: string): void {
  const domain = (env.ALLOWED_EMAIL_DOMAIN ?? '').trim().toLowerCase();
  if (!domain) return;
  if (!email.endsWith(`@${domain}`)) {
    throw new HttpError(
      403,
      `Pendaftaran terhad kepada e-mel @${domain} sahaja.`,
      'domain_not_allowed'
    );
  }
}

function rowToSession(row: UserRow): SessionUser {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    staffId: row.staff_id,
    role: row.role,
    isSystemAdmin: row.is_system_admin === 1,
    deptId: row.dept_id,
    workshopId: row.workshop_id,
    avatarUrl: row.avatar_url,
    deptName: row.dept_name,
    workshopName: row.workshop_name
  };
}

export async function loadUserSession(env: Bindings, userId: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT u.*, d.dept_name, w.workshop_name
       FROM users u
       JOIN departments d ON d.dept_id = u.dept_id
       LEFT JOIN workshops w ON w.workshop_id = u.workshop_id
      WHERE u.user_id = ? AND u.status = 'aktif'`
  )
    .bind(userId)
    .first<UserRow>();
  return row ? rowToSession(row) : null;
}

export async function toAuthUser(env: Bindings, session: SessionUser): Promise<AuthUser> {
  const row = await env.DB.prepare(
    'SELECT status, created_at, last_login_at FROM users WHERE user_id = ?'
  )
    .bind(session.userId)
    .first<{ status: UserStatus; created_at: string; last_login_at: string | null }>();

  return {
    ...session,
    permissions: effectivePermissions(session.role, session.isSystemAdmin),
    institution: 'Politeknik Kuching Sarawak',
    status: row?.status ?? 'aktif',
    createdAt: row?.created_at ?? '',
    lastLoginAt: row?.last_login_at ?? null
  };
}

export interface RegisterResult {
  userId: string;
  status: UserStatus;
}

export async function registerAccount(env: Bindings, input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  assertEmailDomain(env, email);
  assertPasswordPolicy(input.password);

  const staffId = input.staffId?.trim().toUpperCase() || null;

  const existing = await env.DB.prepare(
    'SELECT email, staff_id FROM users WHERE email = ? OR (staff_id IS NOT NULL AND staff_id = ?)'
  )
    .bind(email, staffId ?? '')
    .first<{ email: string; staff_id: string | null }>();

  if (existing) {
    throw new HttpError(
      409,
      existing.email === email
        ? 'E-mel ini telah pun didaftarkan. Sila log masuk atau hubungi Pentadbir Sistem.'
        : 'No. pekerja ini telah pun didaftarkan.',
      'account_exists'
    );
  }

  const dept = await env.DB.prepare('SELECT dept_id FROM departments WHERE dept_id = ?')
    .bind(input.deptId ?? 'dept-jkm')
    .first<{ dept_id: string }>();
  if (!dept) throw new HttpError(400, 'Jabatan tidak sah.', 'invalid_department');

  let workshopId: string | null = input.workshopId?.trim() || null;
  if (workshopId) {
    const workshop = await env.DB.prepare(
      'SELECT workshop_id, dept_id FROM workshops WHERE workshop_id = ?'
    )
      .bind(workshopId)
      .first<{ workshop_id: string; dept_id: string }>();
    if (!workshop) throw new HttpError(400, 'Bengkel / makmal tidak sah.', 'invalid_workshop');
    if (workshop.dept_id !== dept.dept_id) {
      throw new HttpError(
        400,
        'Bengkel / makmal bukan milik jabatan yang dipilih.',
        'workshop_department_mismatch'
      );
    }
  }

  const userId = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(env, input.password);

  await env.DB.prepare(
    `INSERT INTO users
       (user_id, email, staff_id, full_name, role, dept_id, workshop_id, avatar_url, status,
        password_hash, password_updated_at, registration_note, approved_by, approved_at,
        last_login_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'menunggu', ?, ?, ?, NULL, NULL, NULL, ?)`
  )
    .bind(
      userId,
      email,
      staffId,
      input.fullName.trim().toUpperCase(),
      input.role,
      dept.dept_id,
      workshopId,
      passwordHash,
      now,
      (input.note ?? '').trim(),
      now
    )
    .run();

  return { userId, status: 'menunggu' };
}

export async function authenticate(
  env: Bindings,
  identifier: string,
  password: string
): Promise<SessionUser> {
  const cleaned = identifier.trim().toLowerCase();
  const row = await env.DB.prepare(
    `SELECT u.*, d.dept_name, w.workshop_name
       FROM users u
       JOIN departments d ON d.dept_id = u.dept_id
       LEFT JOIN workshops w ON w.workshop_id = u.workshop_id
      WHERE LOWER(u.email) = ? OR LOWER(u.staff_id) = ?`
  )
    .bind(cleaned, cleaned)
    .first<UserRow & { password_hash: string }>();

  const genericError = new HttpError(
    401,
    'E-mel / no. pekerja atau kata laluan tidak sah.',
    'invalid_credentials'
  );

  if (!row) throw genericError;

  const ok = await verifyPassword(env, password, row.password_hash);
  if (!ok) throw genericError;

  if (row.status === 'menunggu') {
    throw new HttpError(
      403,
      'Akaun anda masih menunggu kelulusan Pentadbir Sistem. Sila cuba lagi selepas diluluskan.',
      'pending_approval'
    );
  }
  if (row.status === 'ditolak') {
    throw new HttpError(
      403,
      'Permohonan akaun anda ditolak. Hubungi Pentadbir Sistem untuk maklumat lanjut.',
      'account_rejected'
    );
  }
  if (row.status !== 'aktif') {
    throw new HttpError(403, 'Akaun anda tidak aktif.', 'account_inactive');
  }

  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE user_id = ?')
    .bind(new Date().toISOString(), row.user_id)
    .run();

  return rowToSession(row);
}

export async function changeOwnPassword(
  env: Bindings,
  user: SessionUser,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE user_id = ?')
    .bind(user.userId)
    .first<{ password_hash: string }>();
  if (!row) throw new HttpError(404, 'Pengguna tidak dijumpai.', 'not_found');

  if (!(await verifyPassword(env, currentPassword, row.password_hash))) {
    throw new HttpError(401, 'Kata laluan semasa tidak sah.', 'invalid_credentials');
  }

  assertPasswordPolicy(newPassword);
  const hash = await hashPassword(env, newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_updated_at = ? WHERE user_id = ?'
  )
    .bind(hash, new Date().toISOString(), user.userId)
    .run();
}

export async function setUserPassword(
  env: Bindings,
  userId: string,
  newPassword: string
): Promise<void> {
  assertPasswordPolicy(newPassword);
  const hash = await hashPassword(env, newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_updated_at = ? WHERE user_id = ?'
  )
    .bind(hash, new Date().toISOString(), userId)
    .run();
}

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function isSecureOrigin(env: Bindings): boolean {
  return env.ENVIRONMENT === 'production' || (env.APP_ORIGIN ?? '').startsWith('https://');
}

export async function createSession(c: Context<AppEnv>, user: SessionUser): Promise<string> {
  const token = randomToken();
  await c.env.KV.put(`sess:${token}`, JSON.stringify({ userId: user.userId }), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecureOrigin(c.env),
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
  return token;
}

export function readSessionToken(c: Context): string | null {
  const bearer = c.req.header('Authorization');
  if (bearer?.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export async function getSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const token = readSessionToken(c);
  if (!token) return null;

  const raw = await c.env.KV.get(`sess:${token}`, 'json');
  const payload = raw as { userId?: string } | null;
  if (!payload?.userId) return null;

  await c.env.KV.put(`sess:${token}`, JSON.stringify(payload), {
    expirationTtl: SESSION_TTL_SECONDS
  });

  return loadUserSession(c.env, payload.userId);
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = readSessionToken(c);
  if (token) await c.env.KV.delete(`sess:${token}`);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function rateLimit(
  env: Bindings,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const cacheKey = `rate:${key}:${bucket}`;
  const current = Number((await env.KV.get(cacheKey)) ?? '0');
  if (current >= limit) return false;
  await env.KV.put(cacheKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}
