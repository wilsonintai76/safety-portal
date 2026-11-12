import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';

import { getAiProviderInfo } from '../../shared/ai';
import versionInfo from '../../version.json';
import type { AppEnv } from './types';
import { errorResponse, assert } from './lib/http';
import {
  authenticate,
  changeOwnPassword,
  createSession,
  destroySession,
  getSessionUser,
  rateLimit,
  registerAccount,
  setUserPassword,
  toAuthUser
} from './lib/auth';
import {
  createDocument,
  deleteAttachment,
  deleteDocument,
  getDocumentForUser,
  listAuditLogs,
  listDocuments,
  listMasterData,
  listUsers,
  readAttachment,
  reviewDocument,
  submitDocument,
  updateDocument,
  updateUser,
  uploadAttachment,
  writeAudit
} from './lib/documents';
import { getAiSettings, saveAiSettings, suggestControlMeasures } from './lib/ai';
import {
  aiSettingsSchema,
  aiSuggestionSchema,
  auditQuerySchema,
  changePasswordSchema,
  createDocumentSchema,
  createWorkshopSchema,
  listQuerySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  reviewDocumentSchema,
  updateDocumentSchema,
  updateProfileSchema,
  updateUserSchema,
  userQuerySchema
} from './schemas';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowed = new Set(
        [c.env.APP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(
          (value): value is string => Boolean(value)
        )
      );
      return origin && allowed.has(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

const api = app
  .get('/api/version', (c) =>
    c.json(
      { ...versionInfo, service: 'portal-keselamatan-jkm' },
      200,
      { 'Cache-Control': 'no-store, must-revalidate' }
    )
  )

  .get('/api/health', async (c) => {
    let dbReady = false;
    try {
      const result = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      dbReady = result?.ok === 1;
    } catch {
      dbReady = false;
    }

    return c.json({
      ok: true,
      service: 'portal-keselamatan-jkm',
      version: versionInfo.version,
      buildId: versionInfo.buildId,
      time: new Date().toISOString(),
      bindings: {
        d1: dbReady,
        kv: Boolean(c.env.KV),
        r2: Boolean(c.env.R2),
        workersAi: Boolean(c.env.AI)
      },
      auth: {
        mode: 'password',
        registration: 'admin_approval',
        allowedDomain: c.env.ALLOWED_EMAIL_DOMAIN || null
      },
      ai: {
        defaultProvider: 'cloudflare',
        defaultModel: c.env.AI_MODEL ?? getAiProviderInfo('cloudflare').defaultModel,
        byokEnabled: Boolean(c.env.AI_KEY_ENCRYPTION_SECRET)
      }
    });
  })

  .get('/api/master-data', async (c) => c.json(await listMasterData(c.env)))

  .post('/api/auth/register', zValidator('json', registerSchema), async (c) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'local';
    assert(
      await rateLimit(c.env, `register:${ip}`, 10, 600),
      429,
      'Terlalu banyak permohonan pendaftaran. Cuba lagi kemudian.',
      'rate_limited'
    );

    const { confirmPassword: _confirm, ...input } = c.req.valid('json');
    const result = await registerAccount(c.env, { ...input, confirmPassword: '' });

    await c.env.DB.prepare(
      `INSERT INTO audit_log
         (log_id, actor_id, actor_email, action, resource_type, resource_id, dept_id, detail, created_at)
       VALUES (?, NULL, ?, 'user.register', 'user', ?, ?, ?, ?)`
    )
      .bind(
        `log-${crypto.randomUUID()}`,
        input.email,
        result.userId,
        input.deptId ?? 'dept-jkm',
        JSON.stringify({ role: input.role, staffId: input.staffId ?? '' }),
        new Date().toISOString()
      )
      .run();

    return c.json(
      {
        ok: true,
        status: result.status,
        message:
          'Pendaftaran diterima. Akaun anda perlu diluluskan oleh Pentadbir Sistem sebelum boleh log masuk.'
      },
      201
    );
  })

  .post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'local';
    const { identifier, password } = c.req.valid('json');
    const key = identifier.trim().toLowerCase().slice(0, 120);

    assert(
      await rateLimit(c.env, `login-ip:${ip}`, 40, 300),
      429,
      'Terlalu banyak cubaan log masuk dari rangkaian ini.',
      'rate_limited'
    );
    assert(
      await rateLimit(c.env, `login-user:${key}`, 10, 300),
      429,
      'Terlalu banyak cubaan log masuk untuk akaun ini. Cuba lagi selepas 5 minit.',
      'rate_limited'
    );

    const session = await authenticate(c.env, identifier, password);
    const token = await createSession(c, session);
    await writeAudit(c.env, session, 'auth.login', 'user', session.userId, { mode: 'password' });

    return c.json({ user: await toAuthUser(c.env, session), token });
  })

  // Everything below requires a valid KV-backed session.
  .use('/api/*', async (c, next) => {
    const session = await getSessionUser(c);
    if (!session) {
      return c.json({ error: 'Sesi tamat. Sila log masuk semula.', code: 'unauthenticated' }, 401);
    }
    c.set('user', session);
    await next();
  })

  .get('/api/me', async (c) => c.json({ user: await toAuthUser(c.env, c.get('user')) }))

  .patch('/api/me', zValidator('json', updateProfileSchema), async (c) => {
    const current = c.get('user');
    const { fullName } = c.req.valid('json');
    await c.env.DB.prepare('UPDATE users SET full_name = ? WHERE user_id = ?')
      .bind(fullName, current.userId)
      .run();
    await writeAudit(c.env, current, 'user.profile.update', 'user', current.userId, { fullName });
    return c.json({ user: await toAuthUser(c.env, { ...current, fullName }) });
  })

  .post('/api/me/password', zValidator('json', changePasswordSchema), async (c) => {
    const current = c.get('user');
    const { currentPassword, newPassword } = c.req.valid('json');
    await changeOwnPassword(c.env, current, currentPassword, newPassword);
    await writeAudit(c.env, current, 'user.password.change', 'user', current.userId);
    return c.json({ ok: true });
  })

  .post('/api/auth/logout', async (c) => {
    const user = c.get('user');
    await destroySession(c);
    await writeAudit(c.env, user, 'auth.logout', 'user', user.userId);
    return c.json({ ok: true });
  })

  .get('/api/documents', zValidator('query', listQuerySchema), async (c) => {
    const items = await listDocuments(c.env, c.get('user'), c.req.valid('query'));
    return c.json({ items });
  })

  .get('/api/documents/:id', async (c) => {
    const document = await getDocumentForUser(c.env, c.get('user'), c.req.param('id'));
    return c.json(document);
  })

  .post('/api/documents', zValidator('json', createDocumentSchema), async (c) => {
    const document = await createDocument(c.env, c.get('user'), c.req.valid('json'));
    return c.json(document, 201);
  })

  .patch('/api/documents/:id', zValidator('json', updateDocumentSchema), async (c) => {
    const document = await updateDocument(
      c.env,
      c.get('user'),
      c.req.param('id'),
      c.req.valid('json')
    );
    return c.json(document);
  })

  .post('/api/documents/:id/submit', async (c) => {
    const document = await submitDocument(c.env, c.get('user'), c.req.param('id'));
    return c.json(document);
  })

  .post('/api/documents/:id/review', zValidator('json', reviewDocumentSchema), async (c) => {
    const { decision, note } = c.req.valid('json');
    const document = await reviewDocument(
      c.env,
      c.get('user'),
      c.req.param('id'),
      decision,
      note
    );
    return c.json(document);
  })

  .delete('/api/documents/:id', async (c) => {
    await deleteDocument(c.env, c.get('user'), c.req.param('id'));
    return c.json({ ok: true });
  })

  .post('/api/documents/:id/attachments', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    assert(file instanceof File, 400, 'Fail lampiran diperlukan dalam medan "file".', 'file_required');
    const attachment = await uploadAttachment(c.env, c.get('user'), c.req.param('id'), file);
    return c.json(attachment, 201);
  })

  .get('/api/attachments/:id', async (c) => {
    const { body, attachment } = await readAttachment(c.env, c.get('user'), c.req.param('id'));
    return new Response(body.body, {
      headers: {
        'Content-Type': attachment.content_type,
        'Content-Length': String(attachment.size_bytes),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }
    });
  })

  .delete('/api/attachments/:id', async (c) => {
    await deleteAttachment(c.env, c.get('user'), c.req.param('id'));
    return c.json({ ok: true });
  })

  .get('/api/ai/settings', async (c) => c.json(await getAiSettings(c.env, c.get('user'))))

  .put('/api/ai/settings', zValidator('json', aiSettingsSchema), async (c) => {
    const settings = await saveAiSettings(c.env, c.get('user'), c.req.valid('json'));
    return c.json(settings);
  })

  .post('/api/ai/suggest', zValidator('json', aiSuggestionSchema), async (c) => {
    const user = c.get('user');
    assert(
      await rateLimit(c.env, `ai:${user.userId}`, 30, 60),
      429,
      'Terlalu banyak permintaan AI. Cuba sebentar lagi.',
      'rate_limited'
    );
    return c.json(await suggestControlMeasures(c.env, user, c.req.valid('json')));
  })

  .get('/api/users', zValidator('query', userQuerySchema), async (c) => {
    const items = await listUsers(c.env, c.get('user'), c.req.valid('query'));
    return c.json({ items });
  })

  .patch('/api/users/:id', zValidator('json', updateUserSchema), async (c) => {
    const user = await updateUser(c.env, c.get('user'), c.req.param('id'), c.req.valid('json'));
    return c.json(user);
  })

  .post('/api/users/:id/password', zValidator('json', resetPasswordSchema), async (c) => {
    const actor = c.get('user');
    const targetId = c.req.param('id');
    assert(
      actor.isSystemAdmin,
      403,
      'Hanya Pentadbir Sistem boleh menetapkan semula kata laluan.',
      'forbidden'
    );
    await setUserPassword(c.env, targetId, c.req.valid('json').newPassword);
    await writeAudit(c.env, actor, 'user.password.reset', 'user', targetId);
    return c.json({ ok: true });
  })

  .post('/api/workshops', zValidator('json', createWorkshopSchema), async (c) => {
    const actor = c.get('user');
    assert(
      actor.isSystemAdmin,
      403,
      'Hanya Pentadbir Sistem dibenarkan menambah bengkel atau makmal.',
      'forbidden'
    );
    const input = c.req.valid('json');
    const existing = await c.env.DB.prepare(
      'SELECT workshop_id FROM workshops WHERE UPPER(workshop_name) = ? OR UPPER(workshop_code) = ?'
    )
      .bind(input.name, input.code)
      .first<{ workshop_id: string }>();

    assert(!existing, 409, 'Bengkel dengan nama atau kod ini telah pun wujud.', 'conflict');

    const id = `ws-${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(
      `INSERT INTO workshops (workshop_id, dept_id, workshop_code, workshop_name, kind, block_location)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        input.deptId,
        input.code,
        input.name,
        input.kind,
        input.blockLocation || null
      )
      .run();

    await writeAudit(c.env, actor, 'workshop.create', 'workshop', id, {
      code: input.code,
      name: input.name,
      kind: input.kind,
      blockLocation: input.blockLocation
    });

    return c.json(
      {
        id,
        deptId: input.deptId,
        code: input.code,
        name: input.name,
        kind: input.kind,
        blockLocation: input.blockLocation || null
      },
      201
    );
  })

  .delete('/api/workshops/:id', async (c) => {
    const actor = c.get('user');
    assert(
      actor.isSystemAdmin,
      403,
      'Hanya Pentadbir Sistem dibenarkan memadam bengkel atau makmal.',
      'forbidden'
    );
    const targetId = c.req.param('id');
    const existing = await c.env.DB.prepare(
      'SELECT workshop_id, workshop_name FROM workshops WHERE workshop_id = ?'
    )
      .bind(targetId)
      .first<{ workshop_id: string; workshop_name: string }>();

    assert(existing, 404, 'Bengkel tidak dijumpai.', 'not_found');

    const docCount = await c.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM documents WHERE workshop_id = ?'
    )
      .bind(targetId)
      .first<{ count: number }>();

    assert(
      (docCount?.count ?? 0) === 0,
      409,
      'Bengkel tidak boleh dipadam kerana terdapat dokumen berkaitan.',
      'workshop_in_use'
    );

    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM users WHERE workshop_id = ?'
    )
      .bind(targetId)
      .first<{ count: number }>();

    assert(
      (userCount?.count ?? 0) === 0,
      409,
      'Bengkel tidak boleh dipadam kerana terdapat staf/penyelia yang ditugaskan ke bengkel ini.',
      'workshop_in_use'
    );

    await c.env.DB.prepare('DELETE FROM workshops WHERE workshop_id = ?').bind(targetId).run();
    await writeAudit(c.env, actor, 'workshop.delete', 'workshop', targetId, {
      name: existing.workshop_name
    });

    return c.json({ ok: true });
  })

  .get('/api/audit-logs', zValidator('query', auditQuerySchema), async (c) => {
    const { limit } = c.req.valid('query');
    return c.json({ items: await listAuditLogs(c.env, c.get('user'), limit) });
  });

app.onError((error, c) => errorResponse(c, error));

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Endpoint API tidak dijumpai.', code: 'not_found' }, 404);
  }
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return c.text('Not found', 404);
});

export type AppType = typeof api;

export default api;
