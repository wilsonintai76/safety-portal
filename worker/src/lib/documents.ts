import type { ActionStatus, ChecklistAnswer, SavedReport } from '../../../shared/documents';
import {
  DOCUMENT_STATUS_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type DocumentStatus,
  type Role
} from '../../../shared/roles';
import type { AiSuggestionInput, ChecklistInput, CreateDocumentInput, HirarcInput, ListQuery, ReviewDecision, UpdateDocumentInput, UpdateUserInput } from '../schemas';
import type {
  AdminUserDTO,
  AuditLogDTO,
  Bindings,
  DocumentDTO,
  MasterDataDTO,
  SessionUser,
  UserStatus
} from '../types';
import {
  can,
  canApproveDocument,
  canDeleteDocument,
  canEditDocument,
  canReadDocument,
  canReviewDocument,
  type ResourceAttributes
} from '../pbac';
import { assert, HttpError } from './http';

interface DocumentRow {
  doc_id: string;
  doc_no: string;
  jenis: 'HIRARC' | 'L2B';
  title: string;
  location: string;
  prepared_by: string;
  doc_date: string;
  summary: string;
  status: DocumentStatus;
  owner_id: string;
  dept_id: string;
  workshop_id: string | null;
  max_risk_score: number | null;
  max_risk_level: 'Low' | 'Medium' | 'High' | null;
  compliance_rate: number | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string;
  dept_name: string;
  workshop_name: string | null;
  reviewer_name: string | null;
  hir_no: string | null;
  hirarc_dept_name: string | null;
  prepared_by_name: string | null;
  inspector_name: string | null;
}

interface HirarcRowRecord {
  doc_id: string;
  row_id: string;
  seq: number;
  rnr: 'R' | 'NR';
  work_activity: string;
  hazard: string;
  effect: string;
  existing_control: string;
  likelihood: number;
  severity: number;
  risk_score: number;
  recommended_control: string;
  pic: string;
  due_date: string;
  status: string;
}

interface ChecklistItemRecord {
  doc_id: string;
  item_id: string;
  seq: number;
  section: string;
  item_text: string;
  answer: string;
  remark: string;
}

interface AttachmentRow {
  attachment_id: string;
  doc_id: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  uploader_name: string;
}

interface ResourceRow {
  doc_id: string;
  doc_no: string;
  owner_id: string;
  dept_id: string;
  workshop_id: string | null;
  status: DocumentStatus;
  jenis: 'HIRARC' | 'L2B';
}

const DOCUMENT_SELECT = `
  SELECT d.*,
         u.full_name AS owner_name,
         dep.dept_name AS dept_name,
         w.workshop_name AS workshop_name,
         rv.full_name AS reviewer_name,
         ha.hir_no AS hir_no,
         ha.dept_name AS hirarc_dept_name,
         ha.prepared_by_name AS prepared_by_name,
         ca.inspector_name AS inspector_name
    FROM documents d
    JOIN users u ON u.user_id = d.owner_id
    JOIN departments dep ON dep.dept_id = d.dept_id
    LEFT JOIN workshops w ON w.workshop_id = d.workshop_id
    LEFT JOIN users rv ON rv.user_id = d.reviewed_by
    LEFT JOIN hirarc_assessments ha ON ha.doc_id = d.doc_id
    LEFT JOIN checklist_audits ca ON ca.doc_id = d.doc_id
`;

const ISO_NOW = () => new Date().toISOString();

function placeholders(count: number): string {
  return new Array(count).fill('?').join(',');
}

function displayTimestamp(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19);
}

function riskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 15) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

async function hydrate(
  env: Bindings,
  rows: DocumentRow[]
): Promise<DocumentDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.doc_id);
  const marks = placeholders(ids.length);

  const [hirarcRows, checklistItems, attachments] = await Promise.all([
    env.DB.prepare(`SELECT * FROM hirarc_rows WHERE doc_id IN (${marks}) ORDER BY seq ASC`)
      .bind(...ids)
      .all<HirarcRowRecord>(),
    env.DB.prepare(`SELECT * FROM checklist_items WHERE doc_id IN (${marks}) ORDER BY seq ASC`)
      .bind(...ids)
      .all<ChecklistItemRecord>(),
    env.DB.prepare(
      `SELECT a.*, u.full_name AS uploader_name
         FROM attachments a
         JOIN users u ON u.user_id = a.uploaded_by
        WHERE a.doc_id IN (${marks})
        ORDER BY a.created_at ASC`
    )
      .bind(...ids)
      .all<AttachmentRow>()
  ]);

  const rowsByDoc = new Map<string, HirarcRowRecord[]>();
  for (const row of hirarcRows.results) {
    const list = rowsByDoc.get(row.doc_id) ?? [];
    list.push(row);
    rowsByDoc.set(row.doc_id, list);
  }

  const itemsByDoc = new Map<string, ChecklistItemRecord[]>();
  for (const item of checklistItems.results) {
    const list = itemsByDoc.get(item.doc_id) ?? [];
    list.push(item);
    itemsByDoc.set(item.doc_id, list);
  }

  const attachmentsByDoc = new Map<string, AttachmentRow[]>();
  for (const attachment of attachments.results) {
    const list = attachmentsByDoc.get(attachment.doc_id) ?? [];
    list.push(attachment);
    attachmentsByDoc.set(attachment.doc_id, list);
  }

  return rows.map((row) => {
    const docRows = rowsByDoc.get(row.doc_id) ?? [];
    const docItems = itemsByDoc.get(row.doc_id) ?? [];
    const docAttachments = attachmentsByDoc.get(row.doc_id) ?? [];

    const dto: DocumentDTO = {
      id: row.doc_id,
      docNo: row.doc_no,
      timestamp: displayTimestamp(row.created_at),
      jenis: row.jenis,
      titleOrLocation: row.title,
      location: row.location,
      preparedBy: row.prepared_by,
      date: row.doc_date,
      summary: row.summary,
      maxRiskScore: row.max_risk_score ?? undefined,
      maxRiskLevel: row.max_risk_level ?? undefined,
      complianceRate: row.compliance_rate ?? undefined,
      fileCount: docAttachments.length,
      syncedToD1: true,
      status: row.status,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      deptId: row.dept_id,
      deptName: row.dept_name,
      workshopId: row.workshop_id,
      workshopName: row.workshop_name,
      reviewNote: row.review_note,
      reviewedBy: row.reviewer_name,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      attachments: docAttachments.map((attachment) => ({
        id: attachment.attachment_id,
        fileName: attachment.file_name,
        contentType: attachment.content_type,
        size: attachment.size_bytes,
        url: `/api/attachments/${attachment.attachment_id}`,
        uploadedAt: attachment.created_at,
        uploadedBy: attachment.uploader_name
      }))
    };

    if (row.jenis === 'HIRARC') {
      dto.hirarc = {
        hirNo: row.hir_no ?? '',
        title: row.title,
        dept: row.hirarc_dept_name ?? row.dept_name,
        location: row.location,
        preparedBy: row.prepared_by_name ?? row.prepared_by,
        date: row.doc_date,
        rows: docRows.map((hazardRow) => ({
          id: hazardRow.row_id,
          rnr: hazardRow.rnr,
          workActivity: hazardRow.work_activity,
          hazard: hazardRow.hazard,
          effect: hazardRow.effect,
          existingControl: hazardRow.existing_control,
          l: hazardRow.likelihood,
          s: hazardRow.severity,
          recommendedControl: hazardRow.recommended_control,
          pic: hazardRow.pic,
          dueDate: hazardRow.due_date,
          status: hazardRow.status as ActionStatus
        }))
      };
    } else {
      dto.checklist = {
        nama: row.inspector_name ?? row.prepared_by,
        lokasi: row.location,
        tarikh: row.doc_date,
        items: docItems.map((item) => ({
          id: item.item_id,
          seksyen: item.section,
          item: item.item_text,
          jawapan: item.answer as ChecklistAnswer | '',
          catatan: item.remark
        }))
      };
    }

    return dto;
  });
}

export async function getDocumentById(env: Bindings, docId: string): Promise<DocumentDTO | null> {
  const row = await env.DB.prepare(`${DOCUMENT_SELECT} WHERE d.doc_id = ?`)
    .bind(docId)
    .first<DocumentRow>();
  if (!row) return null;
  const [document] = await hydrate(env, [row]);
  return document;
}

export async function getDocumentResource(env: Bindings, docId: string): Promise<ResourceRow | null> {
  return env.DB.prepare(
    'SELECT doc_id, doc_no, owner_id, dept_id, workshop_id, status, jenis FROM documents WHERE doc_id = ?'
  )
    .bind(docId)
    .first<ResourceRow>();
}

function resourceAttributes(resource: ResourceRow): ResourceAttributes {
  return {
    ownerId: resource.owner_id,
    deptId: resource.dept_id,
    workshopId: resource.workshop_id,
    status: resource.status,
    jenis: resource.jenis
  };
}

function assertCanRead(user: SessionUser, resource: ResourceRow): void {
  assert(
    canReadDocument(user, resourceAttributes(resource)),
    403,
    'Anda tiada akses kepada dokumen ini.',
    'forbidden'
  );
}

export async function getDocumentForUser(
  env: Bindings,
  user: SessionUser,
  docId: string
): Promise<DocumentDTO> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assertCanRead(user, resource);
  const document = await getDocumentById(env, docId);
  assert(document, 404, 'Dokumen tidak dijumpai.', 'not_found');
  return document;
}

export async function listDocuments(
  env: Bindings,
  user: SessionUser,
  query: ListQuery
): Promise<DocumentDTO[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!user.isSystemAdmin) {
    if (user.role === 'penyelaras_osha') {
      clauses.push('d.dept_id = ?');
      params.push(user.deptId);
    } else if (user.workshopId) {
      clauses.push('((d.owner_id = ?) OR (d.workshop_id = ? AND d.dept_id = ?))');
      params.push(user.userId, user.workshopId, user.deptId);
    } else {
      clauses.push('d.owner_id = ?');
      params.push(user.userId);
    }
  }

  if (query.jenis) {
    clauses.push('d.jenis = ?');
    params.push(query.jenis);
  }
  if (query.status) {
    clauses.push('d.status = ?');
    params.push(query.status);
  }
  if (query.location) {
    clauses.push('d.location = ?');
    params.push(query.location);
  }
  if (query.from) {
    clauses.push('d.doc_date >= ?');
    params.push(query.from);
  }
  if (query.to) {
    clauses.push('d.doc_date <= ?');
    params.push(query.to);
  }
  if (query.q) {
    clauses.push('(d.title LIKE ? OR d.doc_no LIKE ? OR d.location LIKE ? OR d.prepared_by LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like, like);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await env.DB.prepare(
    `${DOCUMENT_SELECT} ${where} ORDER BY d.created_at DESC LIMIT ?`
  )
    .bind(...params, query.limit)
    .all<DocumentRow>();

  return hydrate(env, rows.results);
}

function computeHirarcMetrics(hirarc: HirarcInput): {
  maxRiskScore: number;
  maxRiskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
} {
  let maxRiskScore = 0;
  for (const row of hirarc.rows) {
    maxRiskScore = Math.max(maxRiskScore, Number(row.l) * Number(row.s));
  }
  const level = riskLevel(maxRiskScore);
  return {
    maxRiskScore,
    maxRiskLevel: level,
    summary: `${hirarc.rows.length} hazard dinilai. Risiko Tertinggi: ${maxRiskScore} (${level}).`
  };
}

function computeChecklistMetrics(checklist: ChecklistInput): {
  complianceRate: number;
  summary: string;
} {
  let ya = 0;
  let tidak = 0;
  let na = 0;
  for (const item of checklist.items) {
    if (item.jawapan === 'Ya') ya++;
    else if (item.jawapan === 'Tidak') tidak++;
    else if (item.jawapan === 'NA') na++;
  }
  const totalEvaluated = ya + tidak;
  const complianceRate = totalEvaluated > 0 ? Math.round((ya / totalEvaluated) * 100) : 100;
  return {
    complianceRate,
    summary: `Pematuhan: ${complianceRate}% (Ya: ${ya}, Tidak: ${tidak}, NA: ${na}).`
  };
}

async function resolveWorkshopId(
  env: Bindings,
  location: string,
  fallback: string | null
): Promise<string | null> {
  if (location.trim()) {
    const exact = await env.DB.prepare(
      'SELECT workshop_id FROM workshops WHERE workshop_name = ? COLLATE NOCASE LIMIT 1'
    )
      .bind(location.trim())
      .first<{ workshop_id: string }>();
    if (exact) return exact.workshop_id;

    const partial = await env.DB.prepare(
      `SELECT workshop_id FROM workshops
        WHERE ? LIKE '%' || workshop_name || '%'
        ORDER BY length(workshop_name) DESC LIMIT 1`
    )
      .bind(location.trim())
      .first<{ workshop_id: string }>();
    if (partial) return partial.workshop_id;
  }
  return fallback;
}

function docNumber(jenis: 'HIRARC' | 'L2B', now: Date): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${jenis === 'HIRARC' ? 'HIR' : 'L2B'}-${stamp}-${suffix}`;
}

async function auditStatement(
  env: Bindings,
  user: SessionUser,
  action: string,
  resourceType: string,
  resourceId: string,
  detail: Record<string, unknown> = {}
): Promise<D1PreparedStatement> {
  return env.DB.prepare(
    `INSERT INTO audit_log
       (log_id, actor_id, actor_email, action, resource_type, resource_id, dept_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    `log-${crypto.randomUUID()}`,
    user.userId,
    user.email,
    action,
    resourceType,
    resourceId,
    user.deptId,
    JSON.stringify(detail),
    ISO_NOW()
  );
}

export async function writeAudit(
  env: Bindings,
  user: SessionUser,
  action: string,
  resourceType: string,
  resourceId: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await (await auditStatement(env, user, action, resourceType, resourceId, detail)).run();
}

export async function createDocument(
  env: Bindings,
  user: SessionUser,
  input: CreateDocumentInput
): Promise<DocumentDTO> {
  assert(can(user, 'document:create'), 403, 'Anda tiada kebenaran mencipta dokumen.', 'forbidden');

  const now = new Date();
  const nowIso = now.toISOString();
  const status: DocumentStatus = input.submit ? 'dihantar' : 'draf';
  const docId = `doc-${crypto.randomUUID()}`;
  const docNo = docNumber(input.jenis, now);

  const hirarc = input.jenis === 'HIRARC' ? input.hirarc : undefined;
  const checklist = input.jenis === 'L2B' ? input.checklist : undefined;
  assert(hirarc || checklist, 400, 'Payload dokumen tidak lengkap.', 'invalid_payload');

  const location = hirarc?.location ?? checklist!.lokasi;
  const preparedBy = hirarc?.preparedBy ?? checklist!.nama;
  const docDate = hirarc?.date ?? checklist!.tarikh;
  const title = hirarc?.title ?? `Pemeriksaan Keselamatan ${checklist!.lokasi}`;
  const workshopId = await resolveWorkshopId(env, location, user.workshopId);

  const hirarcMetrics = hirarc ? computeHirarcMetrics(hirarc) : null;
  const checklistMetrics = checklist ? computeChecklistMetrics(checklist) : null;
  const summary = hirarcMetrics?.summary ?? checklistMetrics?.summary ?? '';
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO documents
         (doc_id, doc_no, jenis, title, location, prepared_by, doc_date, summary, status,
          owner_id, dept_id, workshop_id, max_risk_score, max_risk_level, compliance_rate,
          submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      docId,
      docNo,
      input.jenis,
      title,
      location,
      preparedBy,
      docDate,
      summary,
      status,
      user.userId,
      user.deptId,
      workshopId,
      hirarcMetrics?.maxRiskScore ?? null,
      hirarcMetrics?.maxRiskLevel ?? null,
      checklistMetrics?.complianceRate ?? null,
      input.submit ? nowIso : null,
      nowIso,
      nowIso
    )
  ];

  if (hirarc) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO hirarc_assessments (doc_id, hir_no, dept_name, location, prepared_by_name)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(docId, hirarc.hirNo, hirarc.dept, hirarc.location, hirarc.preparedBy)
    );

    hirarc.rows.forEach((row, index) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO hirarc_rows
             (row_id, doc_id, seq, rnr, work_activity, hazard, effect, existing_control,
              likelihood, severity, risk_score, recommended_control, pic, due_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `row-${crypto.randomUUID()}`,
          docId,
          index + 1,
          row.rnr,
          row.workActivity,
          row.hazard,
          row.effect,
          row.existingControl,
          row.l,
          row.s,
          row.l * row.s,
          row.recommendedControl,
          row.pic,
          row.dueDate,
          row.status
        )
      );
    });
  }

  if (checklist) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO checklist_audits (doc_id, inspector_name, location, audit_date)
         VALUES (?, ?, ?, ?)`
      ).bind(docId, checklist.nama, checklist.lokasi, checklist.tarikh)
    );

    checklist.items.forEach((item, index) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO checklist_items (item_id, doc_id, seq, section, item_text, answer, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `item-${crypto.randomUUID()}`,
          docId,
          index + 1,
          item.seksyen,
          item.item,
          item.jawapan,
          item.catatan
        )
      );
    });
  }

  statements.push(
    await auditStatement(env, user, input.submit ? 'document.submit' : 'document.create', 'document', docId, {
      docNo,
      jenis: input.jenis,
      status,
      title
    })
  );

  await env.DB.batch(statements);
  const created = await getDocumentById(env, docId);
  assert(created, 500, 'Dokumen gagal dimuatkan selepas disimpan.', 'save_failed');
  return created;
}

export async function updateDocument(
  env: Bindings,
  user: SessionUser,
  docId: string,
  input: UpdateDocumentInput
): Promise<DocumentDTO> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assert(
    canEditDocument(user, resourceAttributes(resource)),
    403,
    'Dokumen hanya boleh dikemas kini oleh pemilik semasa status Draf atau Ditolak.',
    'forbidden'
  );

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let title = '';
  let location = '';
  let preparedBy = '';
  let docDate = '';
  let summary = '';
  let maxRiskScore: number | null = null;
  let maxRiskLevel: 'Low' | 'Medium' | 'High' | null = null;
  let complianceRate: number | null = null;
  let workshopId: string | null = null;

  if (input.hirarc) {
    assert(resource.jenis === 'HIRARC', 400, 'Dokumen ini bukan HIRARC.', 'invalid_jenis');
    const metrics = computeHirarcMetrics(input.hirarc);
    title = input.hirarc.title;
    location = input.hirarc.location;
    preparedBy = input.hirarc.preparedBy;
    docDate = input.hirarc.date;
    summary = metrics.summary;
    maxRiskScore = metrics.maxRiskScore;
    maxRiskLevel = metrics.maxRiskLevel;
    workshopId = await resolveWorkshopId(env, location, user.workshopId);

    statements.push(
      env.DB.prepare('DELETE FROM hirarc_rows WHERE doc_id = ?').bind(docId),
      env.DB.prepare(
        `INSERT INTO hirarc_assessments (doc_id, hir_no, dept_name, location, prepared_by_name)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(doc_id) DO UPDATE SET
           hir_no = excluded.hir_no,
           dept_name = excluded.dept_name,
           location = excluded.location,
           prepared_by_name = excluded.prepared_by_name`
      ).bind(docId, input.hirarc.hirNo, input.hirarc.dept, location, preparedBy)
    );

    input.hirarc.rows.forEach((row, index) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO hirarc_rows
             (row_id, doc_id, seq, rnr, work_activity, hazard, effect, existing_control,
              likelihood, severity, risk_score, recommended_control, pic, due_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `row-${crypto.randomUUID()}`,
          docId,
          index + 1,
          row.rnr,
          row.workActivity,
          row.hazard,
          row.effect,
          row.existingControl,
          row.l,
          row.s,
          row.l * row.s,
          row.recommendedControl,
          row.pic,
          row.dueDate,
          row.status
        )
      );
    });
  }

  if (input.checklist) {
    assert(resource.jenis === 'L2B', 400, 'Dokumen ini bukan Lampiran 2B.', 'invalid_jenis');
    const metrics = computeChecklistMetrics(input.checklist);
    title = `Pemeriksaan Keselamatan ${input.checklist.lokasi}`;
    location = input.checklist.lokasi;
    preparedBy = input.checklist.nama;
    docDate = input.checklist.tarikh;
    summary = metrics.summary;
    complianceRate = metrics.complianceRate;
    workshopId = await resolveWorkshopId(env, location, user.workshopId);

    statements.push(
      env.DB.prepare('DELETE FROM checklist_items WHERE doc_id = ?').bind(docId),
      env.DB.prepare(
        `INSERT INTO checklist_audits (doc_id, inspector_name, location, audit_date)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(doc_id) DO UPDATE SET
           inspector_name = excluded.inspector_name,
           location = excluded.location,
           audit_date = excluded.audit_date`
      ).bind(docId, input.checklist.nama, location, input.checklist.tarikh)
    );

    input.checklist.items.forEach((item, index) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO checklist_items (item_id, doc_id, seq, section, item_text, answer, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `item-${crypto.randomUUID()}`,
          docId,
          index + 1,
          item.seksyen,
          item.item,
          item.jawapan,
          item.catatan
        )
      );
    });
  }

  const nextStatus: DocumentStatus = input.submit ? 'dihantar' : resource.status;

  statements.push(
    env.DB.prepare(
      `UPDATE documents
          SET title = COALESCE(NULLIF(?, ''), title),
              location = COALESCE(NULLIF(?, ''), location),
              prepared_by = COALESCE(NULLIF(?, ''), prepared_by),
              doc_date = COALESCE(NULLIF(?, ''), doc_date),
              summary = COALESCE(NULLIF(?, ''), summary),
              max_risk_score = CASE WHEN ? = 1 THEN ? ELSE max_risk_score END,
              max_risk_level = CASE WHEN ? = 1 THEN ? ELSE max_risk_level END,
              compliance_rate = CASE WHEN ? = 1 THEN ? ELSE compliance_rate END,
              workshop_id = COALESCE(?, workshop_id),
              status = ?,
              submitted_at = CASE WHEN ? = 'dihantar' THEN ? ELSE submitted_at END,
              updated_at = ?
        WHERE doc_id = ?`
    ).bind(
      title,
      location,
      preparedBy,
      docDate,
      summary,
      input.hirarc ? 1 : 0,
      maxRiskScore,
      input.hirarc ? 1 : 0,
      maxRiskLevel,
      input.checklist ? 1 : 0,
      complianceRate,
      workshopId,
      nextStatus,
      nextStatus,
      now,
      now,
      docId
    ),
    await auditStatement(env, user, input.submit ? 'document.submit' : 'document.update', 'document', docId, {
      docNo: resource.doc_no,
      status: nextStatus
    })
  );

  await env.DB.batch(statements);
  const updated = await getDocumentById(env, docId);
  assert(updated, 500, 'Dokumen gagal dimuatkan selepas dikemas kini.', 'save_failed');
  return updated;
}

export async function submitDocument(
  env: Bindings,
  user: SessionUser,
  docId: string
): Promise<DocumentDTO> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assert(
    resource.owner_id === user.userId &&
      ['draf', 'ditolak'].includes(resource.status) &&
      can(user, 'document:submit', resourceAttributes(resource)),
    403,
    'Hanya pemilik boleh menghantar dokumen Draf/Ditolak untuk semakan.',
    'forbidden'
  );

  const now = ISO_NOW();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE documents SET status = 'dihantar', submitted_at = ?, updated_at = ? WHERE doc_id = ?`
    ).bind(now, now, docId),
    env.DB.prepare(
      `INSERT INTO review_actions (action_id, doc_id, actor_id, decision, note, created_at)
       VALUES (?, ?, ?, 'hantar', '', ?)`
    ).bind(`act-${crypto.randomUUID()}`, docId, user.userId, now),
    await auditStatement(env, user, 'document.submit', 'document', docId, { docNo: resource.doc_no })
  ]);

  const updated = await getDocumentById(env, docId);
  assert(updated, 404, 'Dokumen tidak dijumpai.', 'not_found');
  return updated;
}

export async function reviewDocument(
  env: Bindings,
  user: SessionUser,
  docId: string,
  decision: ReviewDecision,
  note: string
): Promise<DocumentDTO> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');

  if (decision === 'semak') {
    assert(
      canReviewDocument(user, resourceAttributes(resource)),
      403,
      'Anda tiada kebenaran menyemak dokumen ini.',
      'forbidden'
    );
  } else if (decision === 'lulus') {
    assert(
      canApproveDocument(user, resourceAttributes(resource)),
      403,
      'Anda tiada kebenaran meluluskan dokumen ini.',
      'forbidden'
    );
  } else {
    assert(
      canReviewDocument(user, resourceAttributes(resource)),
      403,
      'Anda tiada kebenaran menolak dokumen ini.',
      'forbidden'
    );
  }

  const status: DocumentStatus = decision === 'lulus' ? 'diluluskan' : decision === 'tolak' ? 'ditolak' : 'disemak';
  const now = ISO_NOW();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE documents
          SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE doc_id = ?`
    ).bind(status, note, user.userId, now, now, docId),
    env.DB.prepare(
      `INSERT INTO review_actions (action_id, doc_id, actor_id, decision, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(`act-${crypto.randomUUID()}`, docId, user.userId, decision, note, now),
    await auditStatement(env, user, `document.${decision}`, 'document', docId, {
      docNo: resource.doc_no,
      status,
      note
    })
  ]);

  const updated = await getDocumentById(env, docId);
  assert(updated, 404, 'Dokumen tidak dijumpai.', 'not_found');
  return updated;
}

export async function deleteDocument(
  env: Bindings,
  user: SessionUser,
  docId: string
): Promise<void> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assert(
    canDeleteDocument(user, resourceAttributes(resource)),
    403,
    'Anda tiada kebenaran memadam dokumen ini.',
    'forbidden'
  );

  const attachments = await env.DB.prepare('SELECT r2_key FROM attachments WHERE doc_id = ?')
    .bind(docId)
    .all<{ r2_key: string }>();
  for (const attachment of attachments.results) {
    await env.R2.delete(attachment.r2_key);
  }

  await env.DB.prepare('DELETE FROM documents WHERE doc_id = ?').bind(docId).run();
  await (
    await auditStatement(env, user, 'document.delete', 'document', docId, {
      docNo: resource.doc_no,
      jenis: resource.jenis
    })
  ).run();
}

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]);

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

export async function uploadAttachment(
  env: Bindings,
  user: SessionUser,
  docId: string,
  file: File
): Promise<NonNullable<DocumentDTO['attachments']>[number]> {
  const resource = await getDocumentResource(env, docId);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assert(
    resource.status !== 'diluluskan' &&
      can(user, 'attachment:upload', resourceAttributes(resource)),
    403,
    'Lampiran tidak boleh dimuat naik pada dokumen ini.',
    'forbidden'
  );
  assert(file.size > 0, 400, 'Fail kosong tidak dibenarkan.', 'empty_file');
  assert(file.size <= MAX_UPLOAD_BYTES, 413, 'Saiz fail melebihi had 8MB.', 'file_too_large');
  assert(
    ALLOWED_UPLOAD_TYPES.has(file.type),
    415,
    'Hanya imej (JPG, PNG, WEBP, GIF) atau PDF dibenarkan.',
    'unsupported_type'
  );

  const attachmentId = `att-${crypto.randomUUID()}`;
  const key = `documents/${docId}/${attachmentId}-${safeFileName(file.name)}`;
  const now = ISO_NOW();

  await env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { docId, uploadedBy: user.userId }
  });

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO attachments
         (attachment_id, doc_id, r2_key, file_name, content_type, size_bytes, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(attachmentId, docId, key, file.name, file.type, file.size, user.userId, now),
    await auditStatement(env, user, 'attachment.upload', 'attachment', attachmentId, {
      docNo: resource.doc_no,
      fileName: file.name,
      size: file.size
    })
  ]);

  return {
    id: attachmentId,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    url: `/api/attachments/${attachmentId}`,
    uploadedAt: now,
    uploadedBy: user.fullName
  };
}

export async function readAttachment(
  env: Bindings,
  user: SessionUser,
  attachmentId: string
): Promise<{ body: R2ObjectBody; attachment: AttachmentRow }> {
  const attachment = await env.DB.prepare(
    `SELECT a.*, u.full_name AS uploader_name
       FROM attachments a
       JOIN users u ON u.user_id = a.uploaded_by
      WHERE a.attachment_id = ?`
  )
    .bind(attachmentId)
    .first<AttachmentRow>();
  assert(attachment, 404, 'Lampiran tidak dijumpai.', 'not_found');

  const resource = await getDocumentResource(env, attachment.doc_id);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assertCanRead(user, resource);

  const body = await env.R2.get(attachment.r2_key);
  assert(body, 404, 'Fail lampiran tiada dalam storan R2.', 'not_found');
  return { body, attachment };
}

export async function deleteAttachment(
  env: Bindings,
  user: SessionUser,
  attachmentId: string
): Promise<void> {
  const attachment = await env.DB.prepare('SELECT * FROM attachments WHERE attachment_id = ?')
    .bind(attachmentId)
    .first<AttachmentRow>();
  assert(attachment, 404, 'Lampiran tidak dijumpai.', 'not_found');

  const resource = await getDocumentResource(env, attachment.doc_id);
  assert(resource, 404, 'Dokumen tidak dijumpai.', 'not_found');
  assert(
    can(user, 'attachment:upload', resourceAttributes(resource)),
    403,
    'Anda tiada kebenaran memadam lampiran ini.',
    'forbidden'
  );

  await env.R2.delete(attachment.r2_key);
  await env.DB.prepare('DELETE FROM attachments WHERE attachment_id = ?').bind(attachmentId).run();
  await (
    await auditStatement(env, user, 'attachment.delete', 'attachment', attachmentId, {
      docNo: resource.doc_no,
      fileName: attachment.file_name
    })
  ).run();
}

export async function listMasterData(env: Bindings): Promise<MasterDataDTO> {
  const [departments, workshops, riskMatrix] = await Promise.all([
    env.DB.prepare('SELECT dept_id, dept_code, dept_name FROM departments ORDER BY dept_name').all<{
      dept_id: string;
      dept_code: string;
      dept_name: string;
    }>(),
    env.DB.prepare(
      'SELECT workshop_id, dept_id, workshop_code, workshop_name, kind, block_location FROM workshops ORDER BY workshop_name'
    ).all<{
      workshop_id: string;
      dept_id: string;
      workshop_code: string;
      workshop_name: string;
      kind: string;
      block_location: string | null;
    }>(),
    env.DB.prepare(
      'SELECT likelihood, severity, risk_score, risk_level, priority_action, color_code FROM risk_matrix_reference ORDER BY risk_score'
    ).all<{
      likelihood: number;
      severity: number;
      risk_score: number;
      risk_level: string;
      priority_action: string;
      color_code: string;
    }>()
  ]);

  return {
    departments: departments.results.map((row) => ({
      id: row.dept_id,
      code: row.dept_code,
      name: row.dept_name
    })),
    workshops: workshops.results.map((row) => ({
      id: row.workshop_id,
      deptId: row.dept_id,
      code: row.workshop_code,
      name: row.workshop_name,
      kind: row.kind,
      blockLocation: row.block_location
    })),
    riskMatrix: riskMatrix.results.map((row) => ({
      likelihood: row.likelihood,
      severity: row.severity,
      score: row.risk_score,
      level: row.risk_level,
      priorityAction: row.priority_action,
      colorCode: row.color_code
    })),
    roles: (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      permissions: ROLE_PERMISSIONS[role]
    }))
  };
}

export async function listAuditLogs(
  env: Bindings,
  user: SessionUser,
  limit = 100
): Promise<AuditLogDTO[]> {
  assert(
    can(user, 'audit:read', { deptId: user.deptId }),
    403,
    'Anda tiada kebenaran melihat log audit.',
    'forbidden'
  );

  const scoped = !user.isSystemAdmin && user.role === 'penyelaras_osha';
  const sql = scoped
    ? `SELECT * FROM audit_log WHERE dept_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`;

  const statement = env.DB.prepare(sql);
  const result = scoped
    ? await statement.bind(user.deptId, limit).all<Record<string, string>>()
    : await statement.bind(limit).all<Record<string, string>>();

  return result.results.map((row) => ({
    id: row.log_id,
    actorEmail: row.actor_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    deptId: row.dept_id,
    detail: (() => {
      try {
        return JSON.parse(row.detail) as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
    createdAt: row.created_at
  }));
}

export async function listUsers(
  env: Bindings,
  user: SessionUser,
  query: { status?: string; q?: string } = {}
): Promise<AdminUserDTO[]> {
  assert(can(user, 'user:manage'), 403, 'Anda tiada kebenaran mengurus pengguna.', 'forbidden');

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query.status) {
    clauses.push('u.status = ?');
    params.push(query.status);
  }
  if (query.q) {
    clauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.staff_id LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await env.DB.prepare(
    `SELECT u.user_id, u.email, u.full_name, u.staff_id, u.role, u.is_system_admin,
            u.dept_id, u.workshop_id,
            u.status, u.registration_note, u.approved_by, u.approved_at,
            u.created_at, u.last_login_at,
            d.dept_name, w.workshop_name,
            COALESCE(approver.full_name, '') AS approver_name
       FROM users u
       JOIN departments d ON d.dept_id = u.dept_id
       LEFT JOIN workshops w ON w.workshop_id = u.workshop_id
       LEFT JOIN users approver ON approver.user_id = u.approved_by
       ${where}
      ORDER BY CASE u.status WHEN 'menunggu' THEN 0 ELSE 1 END, u.full_name`
  )
    .bind(...params)
    .all<{
      user_id: string;
      email: string;
      full_name: string;
      staff_id: string | null;
      role: Role;
      is_system_admin: number;
      dept_id: string;
      workshop_id: string | null;
      status: UserStatus;
      registration_note: string;
      approved_by: string | null;
      approved_at: string | null;
      created_at: string;
      last_login_at: string | null;
      dept_name: string;
      workshop_name: string | null;
      approver_name: string;
    }>();

  return result.results.map((row) => ({
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    staffId: row.staff_id,
    role: row.role,
    isSystemAdmin: row.is_system_admin === 1,
    deptId: row.dept_id,
    deptName: row.dept_name,
    workshopId: row.workshop_id,
    workshopName: row.workshop_name,
    status: row.status,
    registrationNote: row.registration_note,
    approvedBy: row.approver_name || null,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  }));
}

export async function updateUser(
  env: Bindings,
  actor: SessionUser,
  targetId: string,
  input: UpdateUserInput
): Promise<AdminUserDTO> {
  assert(can(actor, 'user:manage'), 403, 'Anda tiada kebenaran mengurus pengguna.', 'forbidden');

  const target = await env.DB.prepare('SELECT * FROM users WHERE user_id = ?')
    .bind(targetId)
    .first<{
      user_id: string;
      email: string;
      role: Role;
      is_system_admin: number;
      dept_id: string;
      workshop_id: string | null;
      status: UserStatus;
    }>();
  assert(target, 404, 'Pengguna tidak dijumpai.', 'not_found');

  if (targetId === actor.userId && input.status !== undefined && input.status !== 'aktif') {
    throw new HttpError(409, 'Anda tidak boleh mengubah status akaun sendiri.', 'self_lockout');
  }

  const nextIsSystemAdmin = input.isSystemAdmin ?? target.is_system_admin === 1;
  const removesAdmin = target.is_system_admin === 1 && input.isSystemAdmin === false;
  const deactivatesAdmin =
    target.is_system_admin === 1 &&
    input.status !== undefined &&
    input.status !== 'aktif';

  if (removesAdmin || deactivatesAdmin) {
    const admins = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM users WHERE is_system_admin = 1 AND status = 'aktif'`
    ).first<{ total: number }>();
    assert(
      (admins?.total ?? 0) > 1,
      409,
      'Sekurang-kurangnya seorang Pentadbir Sistem mesti kekal aktif.',
      'last_admin'
    );
  }

  const nextDeptId = input.deptId ?? target.dept_id;
  if (input.deptId) {
    const dept = await env.DB.prepare('SELECT dept_id FROM departments WHERE dept_id = ?')
      .bind(input.deptId)
      .first<{ dept_id: string }>();
    assert(dept, 400, 'Jabatan tidak sah.', 'invalid_department');
  }

  let nextWorkshopId = input.workshopId === undefined ? target.workshop_id : input.workshopId;
  if (input.deptId && input.deptId !== target.dept_id && input.workshopId === undefined) {
    nextWorkshopId = null;
  }

  if (nextWorkshopId) {
    const workshop = await env.DB.prepare(
      'SELECT workshop_id, dept_id FROM workshops WHERE workshop_id = ?'
    )
      .bind(nextWorkshopId)
      .first<{ workshop_id: string; dept_id: string }>();
    assert(workshop, 400, 'Bengkel / makmal tidak sah.', 'invalid_workshop');
    assert(
      workshop.dept_id === nextDeptId,
      400,
      'Bengkel / makmal bukan milik jabatan yang dipilih.',
      'workshop_department_mismatch'
    );
  }

  const nextStatus: UserStatus = input.status ?? target.status;
  const approving = target.status !== 'aktif' && nextStatus === 'aktif';
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users
          SET role = ?, is_system_admin = ?, dept_id = ?, workshop_id = ?, status = ?,
              registration_note = COALESCE(?, registration_note),
              approved_by = CASE WHEN ? = 1 THEN ? ELSE approved_by END,
              approved_at = CASE WHEN ? = 1 THEN ? ELSE approved_at END
        WHERE user_id = ?`
    ).bind(
      input.role ?? target.role,
      nextIsSystemAdmin ? 1 : 0,
      nextDeptId,
      nextWorkshopId,
      nextStatus,
      input.registrationNote ?? null,
      approving ? 1 : 0,
      actor.userId,
      approving ? 1 : 0,
      now,
      targetId
    ),
    await auditStatement(
      env,
      actor,
      approving ? 'user.approve' : 'user.update',
      'user',
      targetId,
      {
        email: target.email,
        role: input.role ?? target.role,
        isSystemAdmin: nextIsSystemAdmin,
        deptId: nextDeptId,
        workshopId: nextWorkshopId,
        previousStatus: target.status,
        status: nextStatus
      }
    )
  ]);

  const updated = await listUsers(env, actor);
  const found = updated.find((candidate) => candidate.id === targetId);
  assert(found, 404, 'Pengguna tidak dijumpai.', 'not_found');
  return found;
}
export { DOCUMENT_STATUS_LABELS };


