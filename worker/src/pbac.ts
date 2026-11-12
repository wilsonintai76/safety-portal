import { hasPermission, type Permission } from '../../shared/roles';
import type { SessionUser } from './types';

export interface ResourceAttributes {
  ownerId?: string | null;
  deptId?: string | null;
  workshopId?: string | null;
  status?: string | null;
  jenis?: string | null;
}

const EDITABLE_STATUSES = new Set(['draf', 'ditolak']);

/**
 * Policy-Based Access Control evaluation.
 *
 * `permission` answers the role-level question ("may this role review?"),
 * while `resource` adds attribute-level constraints ("is it in the officer's
 * department, and not their own submission?"). The same function is used by
 * the Worker routes and can be mirrored in the UI via `hasPermission`.
 */
export function can(
  subject: SessionUser,
  permission: Permission,
  resource?: ResourceAttributes
): boolean {
  const isReviewAction = permission === 'document:review' || permission === 'document:approve';

  // Separation of duties applies to everyone, including system administrators.
  if (isReviewAction && resource?.ownerId === subject.userId) return false;

  if (subject.isSystemAdmin) return true;

  if (!hasPermission(subject.role, permission)) return false;

  switch (permission) {
    case 'document:read:own':
      return resource?.ownerId === subject.userId;

    case 'document:read:workshop':
      return (
        resource?.ownerId === subject.userId ||
        (Boolean(subject.workshopId) && resource?.workshopId === subject.workshopId)
      );

    case 'document:read:department':
      return resource?.deptId === subject.deptId;

    case 'document:update:own':
    case 'document:submit':
    case 'document:delete:own':
      return (
        resource?.ownerId === subject.userId &&
        EDITABLE_STATUSES.has(resource?.status ?? '')
      );

    case 'document:review':
    case 'document:approve':
      return resource?.deptId === subject.deptId;

    case 'attachment:upload':
      return (
        resource?.ownerId === subject.userId && resource?.status !== 'diluluskan'
      );

    case 'attachment:read':
      return canReadDocument(subject, resource);

    case 'audit:read':
      return subject.role === 'penyelaras_osha' && resource?.deptId === subject.deptId;

    case 'document:read:all':
    case 'document:delete:any':
    case 'master:manage':
    case 'user:manage':
      return false;

    default:
      return true;
  }
}

export function canReadDocument(
  subject: SessionUser,
  resource?: ResourceAttributes
): boolean {
  if (!resource) return false;
  if (subject.isSystemAdmin) return true;
  if (resource.ownerId === subject.userId) return true;

  if (resource.deptId !== subject.deptId) return false;

  if (subject.role === 'penyelaras_osha') return true;

  return Boolean(subject.workshopId) && resource.workshopId === subject.workshopId;
}

/** Reviewers must act on another officer's submission within their department. */
export function canReviewDocument(
  subject: SessionUser,
  resource: ResourceAttributes
): boolean {
  return (
    can(subject, 'document:review', resource) &&
    ['dihantar', 'disemak'].includes(resource.status ?? '')
  );
}

export function canApproveDocument(
  subject: SessionUser,
  resource: ResourceAttributes
): boolean {
  return (
    can(subject, 'document:approve', resource) &&
    ['dihantar', 'disemak'].includes(resource.status ?? '')
  );
}

export function canEditDocument(
  subject: SessionUser,
  resource: ResourceAttributes
): boolean {
  if (!EDITABLE_STATUSES.has(resource.status ?? '')) return false;
  return can(subject, 'document:update:own', resource);
}

export function canDeleteDocument(
  subject: SessionUser,
  resource: ResourceAttributes
): boolean {
  if (subject.isSystemAdmin) return true;
  return can(subject, 'document:delete:own', resource);
}
