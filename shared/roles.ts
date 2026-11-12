/**
 * Shared role + permission contract used by both the React app and the
 * Cloudflare Worker. Keeping it in one place guarantees the PBAC rules the
 * backend enforces are the same rules the UI renders.
 */

/**
 * Functional roles. "Pentadbir Sistem" is deliberately NOT a role: it is a
 * separate privilege flag (`users.is_system_admin`) so one person can be a
 * workshop supervisor and a system administrator at the same time.
 */
export const ROLES = ['penyelaras_osha', 'penyelia_bengkel'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Roles a person may request through self-registration.
 * Pentadbir Sistem is granted only by another administrator (or the bootstrap
 * script), never requested from the public form.
 */
export const REGISTERABLE_ROLES = ROLES;

export type RegisterableRole = Role;

export const SYSTEM_ADMIN_LABEL = 'Pentadbir Sistem';
export const SYSTEM_ADMIN_SHORT_LABEL = 'Pentadbir Sistem';
export const SYSTEM_ADMIN_DESCRIPTION =
  'Bendera pentadbir yang ditambah di atas peranan fungsi: urus pengguna, peranan, data induk, fasiliti dan audit sistem. Tidak boleh dimohon melalui borang pendaftaran.';

export const ROLE_LABELS: Record<Role, string> = {
  penyelaras_osha: 'Penyelaras OSHA Jabatan',
  penyelia_bengkel: 'Penyelia Bengkel / Makmal / Bilik'
};

export const ROLE_SHORT_LABELS: Record<Role, string> = {
  penyelaras_osha: 'Penyelaras OSHA',
  penyelia_bengkel: 'Penyelia Bengkel'
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  penyelaras_osha:
    'Menyelaras HIRARC dan senarai semak seluruh jabatan, menyemak serta meluluskan dokumen yang dihantar oleh penyelia.',
  penyelia_bengkel:
    'Menyediakan HIRARC dan Lampiran 2B untuk bengkel, makmal atau bilik yang ditugaskan, kemudian menghantar untuk semakan.'
};

export const PERMISSIONS = [
  'document:create',
  'document:read:own',
  'document:read:workshop',
  'document:read:department',
  'document:read:all',
  'document:update:own',
  'document:submit',
  'document:review',
  'document:approve',
  'document:delete:own',
  'document:delete:any',
  'attachment:upload',
  'attachment:read',
  'ai:suggest',
  'master:read',
  'master:manage',
  'user:manage',
  'audit:read',
  'report:export'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  penyelia_bengkel: [
    'document:create',
    'document:read:own',
    'document:read:workshop',
    'document:update:own',
    'document:submit',
    'document:delete:own',
    'attachment:upload',
    'attachment:read',
    'ai:suggest',
    'master:read',
    'report:export'
  ],
  penyelaras_osha: [
    'document:create',
    'document:read:own',
    'document:read:workshop',
    'document:read:department',
    'document:update:own',
    'document:submit',
    'document:review',
    'document:approve',
    'document:delete:own',
    'attachment:upload',
    'attachment:read',
    'ai:suggest',
    'master:read',
    'audit:read',
    'report:export'
  ]
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** System administrators get every permission on top of their functional role. */
export function effectivePermissions(role: Role, isSystemAdmin = false): Permission[] {
  if (isSystemAdmin) return [...PERMISSIONS];
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

export function roleLabel(role: Role, isSystemAdmin = false): string {
  if (isSystemAdmin) return SYSTEM_ADMIN_LABEL;
  return ROLE_LABELS[role] ?? role;
}

export function roleShortLabel(role: Role, isSystemAdmin = false): string {
  if (isSystemAdmin) return SYSTEM_ADMIN_SHORT_LABEL;
  return ROLE_SHORT_LABELS[role] ?? role;
}

/** Maps legacy demo role labels onto the two functional PBAC roles. */
export function normalizeRole(value: string | null | undefined): Role {
  const raw = (value ?? '').trim().toLowerCase();
  if (isRole(raw)) return raw;
  if (raw.includes('sho') || raw.includes('osha') || raw.includes('keselamatan')) {
    return 'penyelaras_osha';
  }
  return 'penyelia_bengkel';
}

export type DocumentStatus = 'draf' | 'dihantar' | 'disemak' | 'diluluskan' | 'ditolak';

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draf: 'Draf',
  dihantar: 'Menunggu Semakan',
  disemak: 'Disemak',
  diluluskan: 'Diluluskan',
  ditolak: 'Ditolak'
};
