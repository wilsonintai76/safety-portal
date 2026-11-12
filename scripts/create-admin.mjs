#!/usr/bin/env node
/**
 * Creates the first Pentadbir Sistem account (approval bootstrap).
 *
 *   node scripts/create-admin.mjs --email wilsonintai76@gmail.com --name "WILSON BIN INTAI" --password "..."
 *
 * Prints a ready-to-run SQL statement. Pass --out bootstrap-admin.sql to write a file
 * that can be executed with:
 *   npx wrangler d1 execute jkm-safety-db --remote --file bootstrap-admin.sql
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const ITERATIONS = Number.parseInt(process.env.PASSWORD_ITERATIONS ?? '100000', 10);

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    dept: { type: 'string', default: 'dept-jkm' },
    out: { type: 'string' }
  }
});

if (!values.email || !values.name || !values.password) {
  console.error('Usage: node scripts/create-admin.mjs --email <email> --name "<full name>" --password "<password>" [--dept dept-jkm] [--out file.sql]');
  process.exit(1);
}

if (values.password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(values.password, salt, ITERATIONS, 32, 'sha256');
const passwordHash = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
const now = new Date().toISOString();
const userId = `usr-admin-${randomBytes(4).toString('hex')}`;

const sql = (value) => `'${String(value).replace(/'/g, "''")}'`;

const statement = `INSERT INTO users (
  user_id, email, staff_id, full_name, role, is_system_admin, dept_id, workshop_id,
  status, password_hash, password_updated_at, registration_note,
  approved_by, approved_at, last_login_at, created_at
) VALUES (
  ${sql(userId)}, ${sql(values.email.trim().toLowerCase())}, NULL, ${sql(values.name.trim().toUpperCase())},
  'penyelaras_osha', 1, ${sql(values.dept)}, NULL,
  'aktif', ${sql(passwordHash)}, ${sql(now)}, 'Akaun pentadbir awal',
  ${sql(userId)}, ${sql(now)}, NULL, ${sql(now)}
)
ON CONFLICT(email) DO UPDATE SET
  is_system_admin = 1,
  status = 'aktif',
  password_hash = excluded.password_hash,
  password_updated_at = excluded.password_updated_at,
  approved_at = excluded.approved_at;
`;

if (values.out) {
  writeFileSync(values.out, statement, 'utf8');
  console.log(`SQL written to ${values.out}`);
  console.log(`Run: npx wrangler d1 execute jkm-safety-db --remote --file ${values.out}`);
} else {
  console.log(statement);
  console.log('-- Run with: npx wrangler d1 execute jkm-safety-db --remote --command "<sql>"');
}
