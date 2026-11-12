import { SavedReport } from '../types/safety';

/** Export helpers only — reports are stored in D1, never in the browser. */

export function exportReportsToJSON(reports: SavedReport[]): string {
  return JSON.stringify(reports, null, 2);
}

export function exportReportsToCSV(reports: SavedReport[]): string {
  const headers = [
    'ID',
    'No. Dokumen',
    'Status',
    'Tarikh',
    'Jenis Borang',
    'Tajuk / Bengkel',
    'Lokasi',
    'Pegawai / Penilai',
    'Ringkasan',
    'Skor Risiko Tertinggi',
    'Tahap Risiko',
    'Pematuhan (%)',
    'Bil Fail'
  ];

  const rows = reports.map((report) => [
    `"${report.id}"`,
    `"${report.docNo ?? ''}"`,
    `"${report.status ?? ''}"`,
    `"${report.date}"`,
    `"${report.jenis === 'HIRARC' ? 'HIRARC (Lampiran 1)' : 'Pemeriksaan (Lampiran 2B)'}"`,
    `"${(report.titleOrLocation || '').replace(/"/g, '""')}"`,
    `"${(report.location || '').replace(/"/g, '""')}"`,
    `"${(report.preparedBy || '').replace(/"/g, '""')}"`,
    `"${(report.summary || '').replace(/"/g, '""')}"`,
    report.maxRiskScore !== undefined ? report.maxRiskScore : '-',
    report.maxRiskLevel || '-',
    report.complianceRate !== undefined ? `${report.complianceRate}%` : '-',
    report.fileCount
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
}
