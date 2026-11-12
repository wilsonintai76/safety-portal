import test from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  canApproveDocument,
  canDeleteDocument,
  canEditDocument,
  canReadDocument,
  canReviewDocument
} from './pbac';
import type { SessionUser } from './types';

const supervisor: SessionUser = {
  userId: 'usr-supervisor',
  email: 'penyelia@poliku.edu.my',
  fullName: 'PENYELIA',
  staffId: null,
  role: 'penyelia_bengkel',
  isSystemAdmin: false,
  deptId: 'dept-jkm',
  workshopId: 'ws-hightech',
  avatarUrl: null,
  deptName: 'Jabatan Kejuruteraan Mekanikal',
  workshopName: 'HIGH TECH LAB'
};

const coordinator: SessionUser = {
  ...supervisor,
  userId: 'usr-coordinator',
  email: 'osha@poliku.edu.my',
  role: 'penyelaras_osha',
  workshopId: null,
  workshopName: null
};

/** A system administrator who is functionally a workshop supervisor. */
const admin: SessionUser = {
  ...supervisor,
  userId: 'usr-admin',
  email: 'admin@poliku.edu.my',
  isSystemAdmin: true
};

const ownDraft = {
  ownerId: supervisor.userId,
  deptId: 'dept-jkm',
  workshopId: 'ws-hightech',
  status: 'draf'
};

const otherSubmitted = {
  ownerId: 'usr-other',
  deptId: 'dept-jkm',
  workshopId: 'ws-hightech',
  status: 'dihantar'
};

test('supervisor reads own/workshop documents but not another workshop', () => {
  assert.equal(canReadDocument(supervisor, ownDraft), true);
  assert.equal(canReadDocument(supervisor, otherSubmitted), true);
  assert.equal(
    canReadDocument(supervisor, {
      ownerId: 'usr-other',
      deptId: 'dept-jkm',
      workshopId: 'ws-kimpalan',
      status: 'dihantar'
    }),
    false
  );
});

test('coordinator reads the whole department but not other departments', () => {
  assert.equal(canReadDocument(coordinator, otherSubmitted), true);
  assert.equal(
    canReadDocument(coordinator, { ...otherSubmitted, deptId: 'dept-lain' }),
    false
  );
});

test('supervisor cannot review or approve', () => {
  assert.equal(canReviewDocument(supervisor, otherSubmitted), false);
  assert.equal(canApproveDocument(supervisor, otherSubmitted), false);
});

test('coordinator reviews another officer but not their own submission', () => {
  assert.equal(canReviewDocument(coordinator, otherSubmitted), true);
  assert.equal(canApproveDocument(coordinator, otherSubmitted), true);
  assert.equal(
    canReviewDocument(coordinator, { ...otherSubmitted, ownerId: coordinator.userId }),
    false
  );
});

test('administrator cannot approve their own document (separation of duties)', () => {
  assert.equal(can(admin, 'document:read:all', otherSubmitted), true);
  assert.equal(
    canApproveDocument(admin, { ...otherSubmitted, ownerId: admin.userId }),
    false
  );
  assert.equal(canApproveDocument(admin, otherSubmitted), true);
});

test('documents are editable only while draf or ditolak', () => {
  assert.equal(canEditDocument(supervisor, ownDraft), true);
  assert.equal(canEditDocument(supervisor, { ...ownDraft, status: 'ditolak' }), true);
  assert.equal(canEditDocument(supervisor, { ...ownDraft, status: 'dihantar' }), false);
  assert.equal(canEditDocument(admin, { ...ownDraft, ownerId: 'usr-other', status: 'diluluskan' }), false);
});

test('owner deletes drafts but not approved documents', () => {
  assert.equal(canDeleteDocument(supervisor, ownDraft), true);
  assert.equal(canDeleteDocument(supervisor, { ...ownDraft, status: 'diluluskan' }), false);
  assert.equal(canDeleteDocument(admin, { ...ownDraft, ownerId: 'usr-other', status: 'diluluskan' }), true);
});

test('attachments cannot be uploaded to approved documents', () => {
  assert.equal(can(supervisor, 'attachment:upload', ownDraft), true);
  assert.equal(can(supervisor, 'attachment:upload', { ...ownDraft, status: 'diluluskan' }), false);
});
