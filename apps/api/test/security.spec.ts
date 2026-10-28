import '../src/common/session.types';
import { Body, Controller, Get, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createDelayReasonBody } from '@ado-metrics/shared';
import type { Request } from 'express';
import request from 'supertest';
import { AuditService, chainHash } from '../src/audit/audit.service';
import { safeReturnTo } from '../src/auth/auth.service';
import { APP_CONFIG, loadConfig, type AppConfig } from '../src/config/config';
import { Public, Roles, SkipCsrf } from '../src/common/decorators';
import { CsrfGuard, ProjectAccessGuard, RolesGuard, SessionAuthGuard } from '../src/common/guards';
import { ProblemDetailsFilter } from '../src/common/problem-details.filter';
import type { SessionUser } from '../src/common/session.types';
import { ZodPipe } from '../src/common/zod-validation.pipe';
import { configureHttp } from '../src/http-security';
import { PrismaService } from '../src/prisma/prisma.service';
import { bodyText, parseServiceBusUrl } from '../src/sync/change-queue.consumer';
import { projectIdFromServiceHook } from '../src/sync/service-hook';

const PROJECT = '6f0e8a4b-2a6c-4d1e-9f3b-1c2d3e4f5a6b';
const OTHER_PROJECT = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';

const baseEnv = {
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(48),
  AUTH_MODE: 'dev',
  ADO_ORG_URL: 'https://dev.azure.com/contoso',
  ADO_AUTH: 'pat',
  ADO_PAT: 'test-pat',
  SYNC_DISABLED: 'true',
};

const viewer: SessionUser = {
  id: 'u-viewer',
  displayName: 'V',
  email: 'v@contoso.dev',
  roles: ['Viewer'],
};
const admin: SessionUser = {
  id: 'u-admin',
  displayName: 'A',
  email: 'a@contoso.dev',
  roles: ['Admin'],
};

@Controller()
class ProbeController {
  @Get('probe')
  @Public()
  probe() {
    return { ok: true };
  }

  /** Test-only sign-in; real sign-in goes through Entra ID. */
  @Post('test-login/:who')
  @Public()
  @SkipCsrf()
  async login(@Req() req: Request, @Param('who') who: string) {
    await new Promise<void>((resolve) => req.session.regenerate(() => resolve()));
    req.session.user = who === 'admin' ? admin : viewer;
    req.session.projectIds = [PROJECT];
    req.session.authenticatedAt = Date.now();
    req.session.csrfToken = 'csrf-token-123';
    return { ok: true };
  }

  @Get('secure')
  secure() {
    return { secret: true };
  }

  @Post('secure')
  mutate(@Body(new ZodPipe(createDelayReasonBody)) body: unknown) {
    return { body };
  }

  @Get('admin-only')
  @Roles('Admin')
  adminOnly() {
    return { admin: true };
  }

  @Get('projects/:projectId/thing')
  @UseGuards(ProjectAccessGuard)
  projectThing() {
    return { ok: true };
  }

  @Get('boom')
  boom() {
    throw new Error('database password is hunter2');
  }
}

function fakePrisma() {
  const sessions = new Map<string, { sid: string; data: unknown; expiresAt: Date }>();
  return {
    session: {
      findUnique: async ({ where }: { where: { sid: string } }) => sessions.get(where.sid) ?? null,
      upsert: async ({
        where,
        create,
      }: {
        where: { sid: string };
        create: { sid: string; data: unknown; expiresAt: Date };
      }) => {
        sessions.set(where.sid, create);
      },
      updateMany: async () => ({ count: 1 }),
      deleteMany: async ({ where }: { where: { sid: string } }) => {
        sessions.delete(where.sid);
        return { count: 1 };
      },
    },
  };
}

async function buildApp(env: Record<string, string> = {}) {
  const config: AppConfig = loadConfig({ ...baseEnv, ...env });
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  @Module({
    imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
    controllers: [ProbeController],
    providers: [
      { provide: APP_CONFIG, useValue: config },
      { provide: AuditService, useValue: audit },
      { provide: PrismaService, useValue: fakePrisma() },
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: SessionAuthGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureHttp(app, config);
  await app.init();
  return { app, audit };
}

async function signIn(app: NestExpressApplication, who: 'viewer' | 'admin') {
  const agent = request.agent(app.getHttpServer());
  await agent.post(`/api/test-login/${who}`).set('Origin', 'http://localhost:3000').expect(201);
  return agent;
}

describe('HTTP security', () => {
  let app: NestExpressApplication;
  let audit: { record: jest.Mock };

  beforeAll(async () => {
    ({ app, audit } = await buildApp());
  });
  afterAll(() => app.close());

  it('sends hardened security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe').expect(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).not.toContain('unsafe-inline');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('requires a session for non-public routes and answers with problem details', async () => {
    const res = await request(app.getHttpServer()).get('/api/secure').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 401, title: 'Authentication required' });
  });

  it('issues an HttpOnly, SameSite session cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/test-login/viewer').expect(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('blocks mutating requests without a valid CSRF token or from another origin', async () => {
    const agent = await signIn(app, 'viewer');
    await agent.post('/api/secure').set('Origin', 'http://localhost:3000').send({}).expect(403);
    await agent
      .post('/api/secure')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', 'csrf-token-123')
      .send({})
      .expect(403);
    await agent
      .post('/api/secure')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', 'wrong-token-000')
      .send({})
      .expect(403);
  });

  it('validates bodies strictly and reports field errors (no mass assignment)', async () => {
    const agent = await signIn(app, 'viewer');
    const res = await agent
      .post('/api/secure')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', 'csrf-token-123')
      .send({ categoryId: 'not-a-guid', comment: 'short', isAdmin: true })
      .expect(422);
    const paths = (res.body.errors as { path: string }[]).map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['categoryId', 'comment']));
    expect(JSON.stringify(res.body)).toMatch(/isAdmin|Unrecognized/);
  });

  it('enforces roles and records denials in the audit log', async () => {
    const agent = await signIn(app, 'viewer');
    await agent.get('/api/admin-only').expect(403);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'authz.denied', outcome: 'denied' }),
    );
    const adminAgent = await signIn(app, 'admin');
    await adminAgent.get('/api/admin-only').expect(200);
  });

  it('hides projects the user cannot access (404, not 403)', async () => {
    const agent = await signIn(app, 'viewer');
    await agent.get(`/api/projects/${PROJECT}/thing`).expect(200);
    await agent.get(`/api/projects/${OTHER_PROJECT}/thing`).expect(404);
    await agent.get('/api/projects/../../etc/thing').expect(404);
  });

  it('never leaks internal error details', async () => {
    const agent = await signIn(app, 'viewer');
    const res = await agent.get('/api/boom').expect(500);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(res.body.traceId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(res.body.traceId);
  });

  it('rejects oversized JSON bodies', async () => {
    const agent = await signIn(app, 'viewer');
    await agent
      .post('/api/secure')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', 'csrf-token-123')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ comment: 'x'.repeat(100_000) }))
      .expect(413)
      .expect('Content-Type', /application\/problem\+json/);
  });

  it('answers malformed JSON with problem details, not a stack trace', async () => {
    const agent = await signIn(app, 'viewer');
    const res = await agent
      .post('/api/secure')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', 'csrf-token-123')
      .set('Content-Type', 'application/json')
      .send('{"comment": ')
      .expect(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.text).not.toMatch(/at .*\.js:\d+/);
  });
});

describe('configuration guard rails', () => {
  const prod = {
    ...baseEnv,
    NODE_ENV: 'production',
    PUBLIC_BASE_URL: 'https://metrics.contoso.com',
  };

  it('refuses dev auth and PAT auth in production', () => {
    expect(() => loadConfig(prod)).toThrow(/AUTH_MODE.*not allowed in production/s);
    expect(() =>
      loadConfig({
        ...prod,
        AUTH_MODE: 'entra',
        ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
        ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
        ENTRA_CLIENT_SECRET: 's',
      }),
    ).toThrow(/ADO_AUTH.*PAT auth is not allowed/s);
  });

  it('requires https and a strong session secret', () => {
    expect(() => loadConfig({ ...baseEnv, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() =>
      loadConfig({
        ...prod,
        PUBLIC_BASE_URL: 'http://metrics.contoso.com',
        AUTH_MODE: 'entra',
        ADO_AUTH: 'managed-identity',
      }),
    ).toThrow(/must be https/);
  });

  it('keeps passwordless dev sign-in on this machine only', () => {
    expect(loadConfig(baseEnv).HOST).toBe('127.0.0.1');
    expect(() => loadConfig({ ...baseEnv, HOST: '0.0.0.0' })).toThrow(/HOST/);
  });

  it('requires a verified database certificate and a 64-character secret in production', () => {
    const entra = {
      ...prod,
      AUTH_MODE: 'entra',
      ADO_AUTH: 'managed-identity',
      ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
      ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
      ENTRA_CLIENT_SECRET: 's',
      HOST: '0.0.0.0',
      SESSION_SECRET: 'x'.repeat(64),
      DATABASE_URL: 'postgresql://u:p@db.example:5432/db?sslmode=verify-full',
    };
    expect(() => loadConfig(entra)).not.toThrow();
    expect(() =>
      loadConfig({ ...entra, DATABASE_URL: 'postgresql://u:p@db.example:5432/db?sslmode=require' }),
    ).toThrow(/verify-full/);
    expect(() => loadConfig({ ...entra, SESSION_SECRET: 'x'.repeat(48) })).toThrow(/64/);
  });

  it('only accepts an https Service Bus queue URL for the change queue', () => {
    const sb = { ...baseEnv, CHANGE_QUEUE_KIND: 'servicebus' };
    expect(() =>
      loadConfig({ ...sb, CHANGE_QUEUE_URL: 'https://ns1.servicebus.windows.net/ado-changes' }),
    ).not.toThrow();
    for (const bad of [
      'http://ns1.servicebus.windows.net/q',
      'https://evil.example/q',
      'https://ns1.servicebus.windows.net/',
    ]) {
      expect(() => loadConfig({ ...sb, CHANGE_QUEUE_URL: bad })).toThrow(/CHANGE_QUEUE_URL/);
    }
    expect(parseServiceBusUrl('https://ns1.servicebus.windows.net/ado-changes')).toEqual({
      host: 'ns1.servicebus.windows.net',
      queue: 'ado-changes',
    });
  });

  it('never prints secret values in configuration errors', () => {
    try {
      loadConfig({ ...baseEnv, SESSION_SECRET: 'tooshort-secret' });
    } catch (e) {
      expect(String(e)).not.toContain('tooshort-secret');
    }
  });
});

describe('input handling helpers', () => {
  it('only allows same-origin relative return paths', () => {
    expect(safeReturnTo('/projects/abc/board?x=1')).toBe('/projects/abc/board?x=1');
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/api/auth/logout',
      '/ok\r\nSet-Cookie: x',
      42,
    ]) {
      expect(safeReturnTo(bad)).toBe('/');
    }
  });

  it('extracts the project id only from well-formed work item service hooks', () => {
    expect(
      projectIdFromServiceHook({
        eventType: 'workitem.updated',
        resourceContainers: { project: { id: PROJECT } },
      }),
    ).toBe(PROJECT);
    expect(
      projectIdFromServiceHook({
        eventType: 'git.push',
        resourceContainers: { project: { id: PROJECT } },
      }),
    ).toBeNull();
    expect(
      projectIdFromServiceHook({
        eventType: 'workitem.updated',
        resourceContainers: { project: { id: "1' OR 1=1" } },
      }),
    ).toBeNull();
    expect(projectIdFromServiceHook('garbage')).toBeNull();
    // Service Bus delivers the same hook as an object, a string or bytes depending on the sender.
    const hook = {
      eventType: 'workitem.updated',
      resourceContainers: { project: { id: PROJECT } },
    };
    for (const body of [hook, JSON.stringify(hook), Buffer.from(JSON.stringify(hook))]) {
      expect(projectIdFromServiceHook(JSON.parse(bodyText(body)!))).toBe(PROJECT);
    }
    expect(bodyText(undefined)).toBeNull();
  });

  it('chains audit hashes so any edit is detectable', () => {
    const row = {
      occurredAt: new Date('2026-01-01T00:00:00Z'),
      actorId: 'u1',
      actorName: 'U',
      action: 'delay_reason.create',
      targetType: 'work_item',
      targetId: '42',
      outcome: 'success',
      ip: '10.0.0.1',
      userAgent: null,
      traceId: 't',
      details: { b: 1, a: 2 },
    };
    const h1 = chainHash(null, row);
    expect(chainHash(null, { ...row, details: { a: 2, b: 1 } })).toBe(h1); // key order independent
    // jsonb drops undefined keys, so the hash written must equal the hash recomputed from the row.
    expect(chainHash(null, { ...row, details: { a: 2, b: 1, c: undefined } as never })).toBe(h1);
    expect(chainHash(null, { ...row, targetId: '43' })).not.toBe(h1);
    expect(chainHash('previous', row)).not.toBe(h1);
  });
});
