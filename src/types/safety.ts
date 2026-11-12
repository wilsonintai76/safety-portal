import type { HirarcRow } from '../../shared/documents';

export * from '../../shared/documents';

export interface PresetTemplate {
  key: string;
  category: string;
  title: string;
  hirNo: string;
  location: string;
  dept: string;
  preparedBy: string;
  rows: Omit<HirarcRow, 'id'>[];
}
