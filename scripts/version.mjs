#!/usr/bin/env node
/**
 * Version manager for the JKM safety portal.
 *
 *   node scripts/version.mjs bump [patch|minor|major]  → increment package.json + version.json
 *   node scripts/version.mjs build                     → keep semver, mint a new build id
 *
 * version.json is the single source of truth: both the Vite bundle and the
 * Worker import it, so the deployed API and the served assets always agree.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const versionPath = resolve(root, 'version.json');

const mode = process.argv[2] ?? 'build';
const bumpType = process.argv[3] ?? 'patch';

if (!['build', 'bump', 'show'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: bump | build | show`);
  process.exit(1);
}

function nextVersion(version, type) {
  const [major, minor, patch] = String(version)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = existsSync(versionPath)
  ? JSON.parse(readFileSync(versionPath, 'utf8'))
  : { version: pkg.version ?? '1.0.0' };

if (mode === 'show') {
  console.log(`Version ${current.version} (build ${current.buildId}, ${current.builtAt})`);
  process.exit(0);
}

let version = current.version ?? pkg.version ?? '1.0.0';

if (mode === 'bump') {
  version = nextVersion(version, bumpType);
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const builtAt = new Date().toISOString();
const stamp = builtAt.replace(/[-:]/g, '').slice(0, 15);
const buildId = `v${version}-${stamp}`;
const payload = { version, buildId, builtAt };

writeFileSync(versionPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[version] ${mode} → ${version} (${buildId})`);
