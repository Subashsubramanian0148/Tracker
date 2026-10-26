import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { json, type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { PrismaSessionStore } from './auth/prisma-session.store';
import type { AppConfig } from './config/config';
import { PrismaService } from './prisma/prisma.service';

export const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'interest-cohort=()',
].join(', ');

/**
 * HTTP-layer hardening shared by main.ts and the integration tests: security headers,
 * body limits, server-side sessions, no-store caching for API data and SPA hosting.
 */
export function configureHttp(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');

  // Correlation id for logs, problem details and audit entries. An upstream id (gateway /
  // Front Door) is reused only if well-formed, so clients can't inject arbitrary log content.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', String(req.id));
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      xFrameOptions: { action: 'deny' },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });

  // Static SPA assets are served before sessions so they never touch the database.
  if (config.STATIC_DIR) serveSpa(app, resolve(config.STATIC_DIR));

  // Only JSON bodies are accepted; anything else arrives empty and fails schema validation.
  app.use('/api/webhooks', json({ limit: '512kb' }));
  app.use(json({ limit: '64kb' }));
  // Body-parser errors happen before Nest's exception filter; answer them as problem details
  // too, so Express's default handler never renders an HTML page with a stack trace.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const status = typeof err === 'object' && err !== null && 'status' in err ? Number(err.status) : 500;
    if (res.headersSent || status < 400 || status >= 500) return next(err);
    res
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: status === 413 ? 'Payload too large' : 'Bad request', status, traceId: String(req.id) });
  });

  const prisma = app.get(PrismaService);
  const idleMs = config.SESSION_IDLE_MINUTES * 60_000;
  app.use(
    session({
      name: config.isProduction ? '__Host-adom.sid' : 'adom.sid',
      secret: config.SESSION_SECRET,
      store: new PrismaSessionStore(prisma, idleMs),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        // Lax (not Strict) so the cookie survives the top-level redirect back from Entra ID.
        sameSite: 'lax',
        path: '/',
        maxAge: idleMs,
      },
    }),
  );

  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });
}

function serveSpa(app: NestExpressApplication, dir: string) {
  const indexHtml = join(dir, 'index.html');
  // STATIC_DIR is operator configuration (validated at startup), never request input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(indexHtml)) throw new Error(`STATIC_DIR has no index.html: ${dir}`);

  app.use(
    express.static(dir, {
      index: false,
      dotfiles: 'deny',
      redirect: false,
      setHeaders: (res, path) => {
        // Vite emits content-hashed file names under /assets, so they can be cached forever.
        res.setHeader(
          'Cache-Control',
          path.includes(`${join(dir, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    if (!req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}
