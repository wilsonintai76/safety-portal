import type { DocumentStatus } from './roles';

export type RoutineType = 'R' | 'NR';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type ActionStatus = 'Selesai' | 'Dalam Tindakan' | 'Belum Selesai' | 'Kekal / Sedia Ada';

export type ChecklistAnswer = 'Ya' | 'Tidak' | 'NA';

export interface HirarcRow {
  id: string;
  rnr: RoutineType;
  workActivity: string;
  hazard: string;
  effect: string;
  existingControl: string;
  l: number; // 1 - 5
  s: number; // 1 - 5
  recommendedControl: string;
  pic: string;
  dueDate: string;
  status: ActionStatus;
}

export interface HirarcData {
  hirNo: string;
  title: string;
  dept: string;
  location: string;
  preparedBy: string;
  date: string;
  rows: HirarcRow[];
}

export interface ChecklistItem {
  id: string;
  seksyen: string;
  item: string;
  jawapan: ChecklistAnswer | '';
  catatan: string;
}

export interface ChecklistData {
  nama: string;
  lokasi: string;
  tarikh: string;
  items: ChecklistItem[];
}

export interface UploadedFile {
  name: string;
  mime: string;
  size: number;
  data: string; // base64
  previewUrl?: string;
}

export interface AttachmentInfo {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

/**
 * Frontend view-model returned by the Worker. Optional workflow fields keep
 * older locally-cached reports readable after the backend migration.
 */
export interface SavedReport {
  id: string;
  timestamp: string;
  jenis: 'HIRARC' | 'L2B';
  titleOrLocation: string;
  location: string;
  preparedBy: string;
  date: string;
  summary: string;
  maxRiskScore?: number;
  maxRiskLevel?: RiskLevel;
  complianceRate?: number;
  hirarc?: HirarcData;
  checklist?: ChecklistData;
  fileCount: number;
  syncedToD1?: boolean;
  docNo?: string;
  status?: DocumentStatus;
  ownerId?: string;
  ownerName?: string;
  deptId?: string;
  deptName?: string;
  workshopId?: string | null;
  workshopName?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  attachments?: AttachmentInfo[];
}
