import type {
  AiSettingsDTO,
  AiProvider,
  AiSuggestionResultDTO,
  UpdateAiSettingsInput
} from '../../shared/ai';
import type { Permission, Role } from '../../shared/roles';
import type { ChecklistData, HirarcData, SavedReport, UploadedFile } from '../types/safety';
import type { AccountStatus, UserProfile } from '../types/auth';
import { API_BASE, api, getStoredApiToken, readApiError, setStoredApiToken } from './api';

interface ServerAuthUser {
  userId: string;
  email: string;
  fullName: string;
  staffId: string | null;
  role: Role;
  isSystemAdmin: boolean;
  deptId: string;
  workshopId: string | null;
  avatarUrl: string | null;
  deptName: string;
  workshopName: string | null;
  permissions: Permission[];
  institution: string;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResult {
  user: UserProfile;
  token: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  staffId?: string;
  role: Role;
  deptId?: string;
  workshopId?: string | null;
  note?: string;
  password: string;
  confirmPassword: string;
}

export interface CreateDocumentPayload {
  jenis: 'HIRARC' | 'L2B';
  submit?: boolean;
  hirarc?: HirarcData;
  checklist?: ChecklistData;
}

export interface ReviewDecisionInput {
  decision: 'semak' | 'lulus' | 'tolak';
  note: string;
}

function withAttachmentUrls(document: SavedReport): SavedReport {
  if (!document.attachments?.length) return document;
  const origin = new URL(API_BASE, window.location.origin).origin;
  return {
    ...document,
    attachments: document.attachments.map((attachment) => ({
      ...attachment,
      url: attachment.url.startsWith('http') ? attachment.url : `${origin}${attachment.url}`
    }))
  };
}

function toUserProfile(user: ServerAuthUser): UserProfile {
  return {
    id: user.userId,
    name: user.fullName,
    email: user.email,
    staffId: user.staffId ?? '',
    department: user.deptName,
    workshopLocation: user.workshopName ?? '',
    role: user.role,
    isSystemAdmin: Boolean(user.isSystemAdmin),
    avatarUrl: user.avatarUrl ?? undefined,
    institution: user.institution,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? '',
    permissions: user.permissions,
    deptId: user.deptId,
    workshopId: user.workshopId
  };
}

/* ------------------------------------------------------------------ */
/* Health + version                                                    */
/* ------------------------------------------------------------------ */

export interface HealthStatus {
  ok: boolean;
  service: string;
  version: string;
  buildId: string;
  time: string;
  bindings: { d1: boolean; kv: boolean; r2: boolean; workersAi: boolean };
  auth: { mode: string; registration: string; allowedDomain: string | null };
  ai: { defaultProvider: string; defaultModel: string; byokEnabled: boolean };
}

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as HealthStatus;
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function fetchSession(): Promise<UserProfile | null> {
  const response = await api.api.me.$get();
  if (response.status === 401) {
    setStoredApiToken(null);
    return null;
  }
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return toUserProfile(data.user as ServerAuthUser);
}

export async function loginWithPassword(
  identifier: string,
  password: string
): Promise<LoginResult> {
  const response = await api.api.auth.login.$post({
    json: { identifier, password } as never
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  setStoredApiToken(data.token);
  return { user: toUserProfile(data.user as ServerAuthUser), token: data.token };
}

export async function registerAccount(payload: RegisterPayload): Promise<string> {
  const response = await api.api.auth.register.$post({ json: payload as never });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = (await response.json()) as { message: string };
  return data.message;
}

export async function signOut(): Promise<void> {
  try {
    await api.api.auth.logout.$post();
  } catch {
    // Local cache is cleared even when the Worker is unreachable.
  } finally {
    setStoredApiToken(null);
  }
}

export async function updateMyProfile(fullName: string): Promise<UserProfile> {
  const response = await api.api.me.$patch({ json: { fullName } });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return toUserProfile(data.user as ServerAuthUser);
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const response = await api.api.me.password.$post({
    json: { currentPassword, newPassword } as never
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export async function fetchDocuments(): Promise<SavedReport[]> {
  const response = await api.api.documents.$get({ query: {} });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return (data.items as unknown as SavedReport[]).map(withAttachmentUrls);
}

export async function createDocument(
  payload: CreateDocumentPayload,
  files: UploadedFile[] = []
): Promise<{ document: SavedReport; attachmentErrors: string[] }> {
  const response = await api.api.documents.$post({
    json: {
      jenis: payload.jenis,
      submit: payload.submit ?? true,
      hirarc: payload.hirarc,
      checklist: payload.checklist
    } as never
  });
  if (!response.ok) throw new Error(await readApiError(response));

  const document = withAttachmentUrls((await response.json()) as unknown as SavedReport);
  const attachmentErrors: string[] = [];

  for (const file of files) {
    try {
      await uploadAttachment(document.id, file);
    } catch (error) {
      attachmentErrors.push(
        `${file.name}: ${error instanceof Error ? error.message : 'gagal dimuat naik'}`
      );
    }
  }

  return { document, attachmentErrors };
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function uploadAttachment(documentId: string, file: UploadedFile): Promise<void> {
  const form = new FormData();
  form.append('file', base64ToBlob(file.data, file.mime), file.name);

  const headers: Record<string, string> = {};
  const token = getStoredApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/documents/${documentId}/attachments`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers
  });

  if (!response.ok) throw new Error(await readApiError(response));
}

export async function importDocuments(
  reports: SavedReport[]
): Promise<{ imported: number; failed: string[] }> {
  let imported = 0;
  const failed: string[] = [];

  for (const report of reports) {
    try {
      if (report.hirarc) {
        await createDocument({ jenis: 'HIRARC', submit: true, hirarc: report.hirarc });
      } else if (report.checklist) {
        await createDocument({ jenis: 'L2B', submit: true, checklist: report.checklist });
      } else {
        failed.push(`${report.id}: tiada data HIRARC/checklist`);
        continue;
      }
      imported += 1;
    } catch (error) {
      failed.push(`${report.id}: ${error instanceof Error ? error.message : 'gagal'}`);
    }
  }

  return { imported, failed };
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await api.api.documents[':id'].$delete({ param: { id } });
  if (!response.ok) throw new Error(await readApiError(response));
}

export async function submitDocument(id: string): Promise<SavedReport> {
  const response = await api.api.documents[':id'].submit.$post({ param: { id } });
  if (!response.ok) throw new Error(await readApiError(response));
  return withAttachmentUrls((await response.json()) as unknown as SavedReport);
}

export async function reviewDocument(
  id: string,
  input: ReviewDecisionInput
): Promise<SavedReport> {
  const response = await api.api.documents[':id'].review.$post({
    param: { id },
    json: input
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return withAttachmentUrls((await response.json()) as unknown as SavedReport);
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export async function getAiSettings(): Promise<AiSettingsDTO> {
  const response = await api.api.ai.settings.$get();
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as AiSettingsDTO;
}

export async function saveAiSettings(input: UpdateAiSettingsInput): Promise<AiSettingsDTO> {
  const response = await api.api.ai.settings.$put({ json: input as never });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as AiSettingsDTO;
}

export interface SuggestControlsInput {
  workActivity: string;
  hazard: string;
  effect?: string;
  existingControl?: string;
  likelihood: number;
  severity: number;
  riskLevel?: string;
  workshop?: string;
}

export async function suggestControls(
  input: SuggestControlsInput
): Promise<AiSuggestionResultDTO> {
  const response = await api.api.ai.suggest.$post({ json: input as never });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as AiSuggestionResultDTO;
}

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export interface MasterData {
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
  roles: Array<{ role: Role; label: string; description: string; permissions: Permission[] }>;
}

export async function getMasterData(): Promise<MasterData> {
  const response = await api.api['master-data'].$get();
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as MasterData;
}

export interface CreateWorkshopInput {
  deptId?: string;
  code: string;
  name: string;
  kind?: 'bengkel' | 'makmal' | 'bilik';
  blockLocation?: string | null;
}

export async function createWorkshop(input: CreateWorkshopInput): Promise<MasterData['workshops'][number]> {
  const response = await api.api.workshops.$post({ json: input as never });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as MasterData['workshops'][number];
}

export async function deleteWorkshop(id: string): Promise<void> {
  const response = await api.api.workshops[':id'].$delete({ param: { id } });
  if (!response.ok) throw new Error(await readApiError(response));
}

/* ------------------------------------------------------------------ */
/* Admin: users                                                        */
/* ------------------------------------------------------------------ */

export interface AdminUser {
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
  status: AccountStatus;
  registrationNote: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export async function listUsers(status?: AccountStatus): Promise<AdminUser[]> {
  const response = await api.api.users.$get({
    query: status ? { status } : {}
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return data.items as unknown as AdminUser[];
}

export async function updateUser(
  id: string,
  input: {
    role?: Role;
    isSystemAdmin?: boolean;
    deptId?: string;
    workshopId?: string | null;
    status?: AccountStatus;
    registrationNote?: string;
  }
): Promise<AdminUser> {
  const response = await api.api.users[':id'].$patch({ param: { id }, json: input as never });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as unknown as AdminUser;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const response = await api.api.users[':id'].password.$post({
    param: { id },
    json: { newPassword } as never
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditLogItem {
  id: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  deptId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditLogs(limit = 100): Promise<AuditLogItem[]> {
  const response = await api.api['audit-logs'].$get({ query: { limit: String(limit) } });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return data.items as unknown as AuditLogItem[];
}

export type { AiProvider };
