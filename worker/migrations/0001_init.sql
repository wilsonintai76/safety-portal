-- Portal Keselamatan JKM — D1 schema (normalised operational model)
-- All timestamps are ISO-8601 UTC strings. Document dates use YYYY-MM-DD.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  dept_id TEXT PRIMARY KEY,
  dept_code TEXT NOT NULL UNIQUE,
  dept_name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'Politeknik Kuching Sarawak'
);

CREATE TABLE IF NOT EXISTS workshops (
  workshop_id TEXT PRIMARY KEY,
  dept_id TEXT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
  workshop_code TEXT NOT NULL UNIQUE,
  workshop_name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'bengkel' CHECK (kind IN ('bengkel', 'makmal', 'bilik')),
  block_location TEXT
);

-- Password accounts with administrator approval.
-- status: menunggu (awaiting approval) | aktif | ditolak | nyahaktif
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  staff_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('penyelaras_osha', 'penyelia_bengkel', 'pentadbir_sistem')),
  dept_id TEXT NOT NULL REFERENCES departments(dept_id),
  workshop_id TEXT REFERENCES workshops(workshop_id),
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu', 'aktif', 'ditolak', 'nyahaktif')),
  password_hash TEXT NOT NULL,
  password_updated_at TEXT NOT NULL,
  registration_note TEXT NOT NULL DEFAULT '',
  approved_by TEXT REFERENCES users(user_id),
  approved_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_dept ON users(dept_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY,
  doc_no TEXT NOT NULL UNIQUE,
  jenis TEXT NOT NULL CHECK (jenis IN ('HIRARC', 'L2B')),
  title TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  prepared_by TEXT NOT NULL DEFAULT '',
  doc_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'dihantar', 'disemak', 'diluluskan', 'ditolak')),
  owner_id TEXT NOT NULL REFERENCES users(user_id),
  dept_id TEXT NOT NULL REFERENCES departments(dept_id),
  workshop_id TEXT REFERENCES workshops(workshop_id),
  max_risk_score INTEGER,
  max_risk_level TEXT CHECK (max_risk_level IN ('Low', 'Medium', 'High')),
  compliance_rate INTEGER,
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(user_id),
  reviewed_at TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_scope ON documents(dept_id, workshop_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(doc_date DESC);

CREATE TABLE IF NOT EXISTS hirarc_assessments (
  doc_id TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  hir_no TEXT NOT NULL,
  dept_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  prepared_by_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS hirarc_rows (
  row_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  rnr TEXT NOT NULL CHECK (rnr IN ('R', 'NR')),
  work_activity TEXT NOT NULL DEFAULT '',
  hazard TEXT NOT NULL DEFAULT '',
  effect TEXT NOT NULL DEFAULT '',
  existing_control TEXT NOT NULL DEFAULT '',
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  risk_score INTEGER NOT NULL,
  recommended_control TEXT NOT NULL DEFAULT '',
  pic TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Belum Selesai'
);

CREATE INDEX IF NOT EXISTS idx_hirarc_rows_doc ON hirarc_rows(doc_id, seq);

CREATE TABLE IF NOT EXISTS checklist_audits (
  doc_id TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  inspector_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  audit_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_items (
  item_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  item_text TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL CHECK (answer IN ('Ya', 'Tidak', 'NA', '')),
  remark TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_doc ON checklist_items(doc_id, seq);

CREATE TABLE IF NOT EXISTS attachments (
  attachment_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_doc ON attachments(doc_id);

CREATE TABLE IF NOT EXISTS review_actions (
  action_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(user_id),
  decision TEXT NOT NULL CHECK (decision IN ('hantar', 'semak', 'lulus', 'tolak')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_actions_doc ON review_actions(doc_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '',
  dept_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_dept ON audit_log(dept_id, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_matrix_reference (
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  priority_action TEXT NOT NULL,
  color_code TEXT NOT NULL,
  PRIMARY KEY (likelihood, severity)
);

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO departments (dept_id, dept_code, dept_name)
VALUES ('dept-jkm', 'JKM', 'Jabatan Kejuruteraan Mekanikal');

INSERT OR IGNORE INTO workshops (workshop_id, dept_id, workshop_code, workshop_name, kind) VALUES
  ('ws-hightech', 'dept-jkm', 'HTL', 'HIGH TECH LAB', 'makmal'),
  ('ws-pemesinan', 'dept-jkm', 'BPA', 'BENGKEL PEMESINAN AM', 'bengkel'),
  ('ws-kimpalan', 'dept-jkm', 'BKF', 'BENGKEL KIMPALAN & FABRIKASI LOGAM', 'bengkel'),
  ('ws-foundri', 'dept-jkm', 'BFT', 'BENGKEL FOUNDRI / TUANGAN', 'bengkel'),
  ('ws-automotif', 'dept-jkm', 'BAT', 'BENGKEL AUTOMOTIF', 'bengkel'),
  ('ws-ppu', 'dept-jkm', 'PPU', 'BENGKEL PENYEJUKAN & PENYAMANAN UDARA (PPU)', 'bengkel'),
  ('ws-metalurgi', 'dept-jkm', 'MKB', 'MAKMAL METALURGI & KEKUATAN BAHAN', 'makmal'),
  ('ws-cadcam', 'dept-jkm', 'CAD', 'MAKMAL CAD/CAM', 'makmal'),
  ('ws-termofluid', 'dept-jkm', 'MTF', 'MAKMAL TERMOFLUID', 'makmal'),
  ('ws-mekatronik', 'dept-jkm', 'MKR', 'MAKMAL MEKATRONIK & ROBOTIK', 'makmal'),
  ('ws-penyenggaraan', 'dept-jkm', 'BPM', 'BENGKEL PENYENGGARAAN MEKANIKAL', 'bengkel');

INSERT OR IGNORE INTO risk_matrix_reference
  (likelihood, severity, risk_score, risk_level, priority_action, color_code)
VALUES
  (1, 1, 1, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (1, 2, 2, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (1, 3, 3, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (1, 4, 4, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (1, 5, 5, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (2, 1, 2, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (2, 2, 4, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (2, 3, 6, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (2, 4, 8, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (2, 5, 10, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (3, 1, 3, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (3, 2, 6, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (3, 3, 9, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (3, 4, 12, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (3, 5, 15, 'High', 'Tindakan segera diperlukan', '#dc2626'),
  (4, 1, 4, 'Low', 'Pantau dan kekalkan kawalan sedia ada', '#059669'),
  (4, 2, 8, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (4, 3, 12, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (4, 4, 16, 'High', 'Tindakan segera diperlukan', '#dc2626'),
  (4, 5, 20, 'High', 'Tindakan segera diperlukan', '#dc2626'),
  (5, 1, 5, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (5, 2, 10, 'Medium', 'Rancang tindakan pembaikan', '#f59e0b'),
  (5, 3, 15, 'High', 'Tindakan segera diperlukan', '#dc2626'),
  (5, 4, 20, 'High', 'Tindakan segera diperlukan', '#dc2626'),
  (5, 5, 25, 'High', 'Tindakan segera diperlukan', '#dc2626');
