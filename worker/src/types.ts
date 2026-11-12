import type { Role, Permission } from '../../shared/roles';
import type { SavedReport } from '../../shared/documents';

export type UserStatus = 'menunggu' | 'aktif' | 'ditolak' | 'nyahaktif';

export interface Bindings {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  ASSETS?: Fetcher;
  /** Optional: restrict registration to a single e-mail domain, e.g. "poliku.edu.my". */
  ALLOWED_EMAIL_DOMAIN?: string;
  /** Optional PBKDF2 iteration override (default 120000). */
  PASSWORD_ITERATIONS?: string;
  AI_MODEL?: string;
  AI_KEY_ENCRYPTION_SECRET?: string;
  APP_ORIGIN?: string;
  ENVIRONMENT?: string;
}

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string;
  staffId: string | null;
  role: Role;
  /** Privilege flag: full administrative rights on top of the functional role. */
  isSystemAdmin: boolean;
  deptId: string;
  workshopId: string | null;
  avatarUrl: string | null;
  deptName: string;
  workshopName: string | null;
}

export interface AuthUser extends SessionUser {
  permissions: Permission[];
  institution: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user: SessionUser;
  };
};

export type DocumentDTO = SavedReport & {
  id: string;
  docNo: string;
  status: NonNullable<SavedReport['status']>;
  ownerId: string;
  ownerName: string;
  deptId: string;
  deptName: string;
  createdAt: string;
  updatedAt: string;
  attachments: NonNullable<SavedReport['attachments']>;
};

export interface MasterDataDTO {
  departments: Array<{ id: string; code: string; name: string }>;
  workshops: Array<{
    id: string;
    deptId: string;
    code: string;
    name: string;
    kind: string;
    blockLocation: string | null;
  }>;
  riskMatrix: Array<{
    likelihood: number;
    severity: number;
    score: number;
    level: string;
    priorityAction: string;
    colorCode: string;
  }>;
  roles: Array<{
    role: Role;
    label: string;
    description: string;
    permissions: Permission[];
  }>;
}

export interface AuditLogDTO {
  id: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  deptId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserDTO {
  id: string;
  email: string;
  fullName: string;
  staffId: string | null;
  role: Role;
  isSystemAdmin: boolean;
  deptId: string;
  deptName: string;
  workshopId: string | null;
  workshopName: string | null;
  status: UserStatus;
  registrationNote: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}
