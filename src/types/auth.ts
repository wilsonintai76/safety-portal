import type { Permission, Role } from '../../shared/roles';

export type UserRole = Role;

export type AccountStatus = 'menunggu' | 'aktif' | 'ditolak' | 'nyahaktif';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  staffId: string;
  department: string;
  workshopLocation: string;
  role: UserRole;
  isSystemAdmin?: boolean;
  avatarUrl?: string;
  institution?: string;
  status?: AccountStatus;
  createdAt: string;
  lastLoginAt: string;
  permissions?: Permission[];
  deptId?: string;
  workshopId?: string | null;
}

export interface RegisterFormData {
  name: string;
  email: string;
  staffId: string;
  department: string;
  workshopLocation: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
  note?: string;
}

export interface LoginFormData {
  identifier: string;
  password: string;
  rememberMe: boolean;
}
