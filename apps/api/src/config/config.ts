import { z } from 'zod';

/**
 * All runtime configuration comes from environment variables and is validated at startup.
 * The process refuses to start with an insecure combination (e.g. dev auth in production),
 * so a misconfiguration fails loudly at deploy time instead of silently at runtime.
 */
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const csv = z.string().transform((s) =>
  s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    PUBLIC_BASE_URL: z.url(),
    /** Extra origins allowed to send mutating requests (local Vite dev server). */
    ALLOWED_ORIGINS: csv.default([]),
    STATIC_DIR: z.string().optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

    DATABASE_URL: z.string().min(1),

    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24).default(8),

    /** Company email domains allowed to sign in, e.g. "cspl.com". Empty = any account in the tenant. */
    ALLOWED_EMAIL_DOMAINS: csv
      .transform((d) => d.map((x) => x.toLowerCase().replace(/^@/, '')))
      .default([]),
    /** Emails allowed into Admin (sync, categories, audit log). Everyone else: their own projects. */
    ADMIN_EMAILS: csv.transform((d) => d.map((x) => x.toLowerCase())).default([]),
    AUTH_MODE: z.enum(['entra', 'dev']).default('entra'),
    ENTRA_TENANT_ID: z.guid().optional(),
    ENTRA_CLIENT_ID: z.guid().optional(),
    ENTRA_CLIENT_SECRET: z.string().min(1).optional(),

    ADO_ORG_URL: z
      .url()
      .refine((u) => u.startsWith('https://'), 'ADO_ORG_URL must use https')
      .transform((u) => u.replace(/\/+$/, '')),
    ADO_AUTH: z.enum(['managed-identity', 'client-secret', 'pat']).default('managed-identity'),
    /** Client id of the user-assigned managed identity (ADO sync and change queue). */
    AZURE_CLIENT_ID: z.guid().optional(),
    ADO_PAT: z.string().min(1).optional(),
    ADO_PROJECTS: csv.default([]),
    /** Only sync this team's board (its columns and area paths), e.g. "UX". Empty = whole project. */
    ADO_TEAM: z.string().trim().min(1).optional(),
    /** When true, the scheduler and queue consumer are disabled (demo data / tests). */
    SYNC_DISABLED: bool.default(false),
    SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(86_400).default(10),
    SYNC_LOOKBACK_DAYS: z.coerce.number().int().min(30).max(3650).default(730),

    CHANGE_QUEUE_KIND: z.enum(['none', 'storage', 'servicebus']).default('none'),
    CHANGE_QUEUE_URL: z.url().optional(),
    WEBHOOK_BASIC_USER: z.string().min(8).optional(),
    WEBHOOK_BASIC_PASSWORD: z.string().min(24).optional(),

    RETENTION_DAYS: z.coerce.number().int().min(90).max(3650).default(730),
    /** Blocked longer than this (hours) raises the LONG_BLOCKED delay flag. */
    DELAY_BLOCKED_HOURS: z.coerce.number().min(1).max(720).default(48),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const isProd = env.NODE_ENV === 'production';

    if (isProd && env.AUTH_MODE === 'dev')
      issue('AUTH_MODE', 'dev auth is not allowed in production');
    // Dev sign-in needs no password, so it only ever runs on this machine, whatever
    // NODE_ENV says (a forgotten NODE_ENV must not expose it on a real host).
    if (
      env.AUTH_MODE === 'dev' &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(env.PUBLIC_BASE_URL)
    ) {
      issue('AUTH_MODE', 'dev auth is only allowed when PUBLIC_BASE_URL is http://localhost');
    }
    if (isProd && env.ADO_AUTH === 'pat')
      issue('ADO_AUTH', 'PAT auth is not allowed in production');
    // The server forces TLS too (require_secure_transport); refuse a client that would not use it.
    if (isProd && !/[?&]sslmode=(require|verify-ca|verify-full)\b/.test(env.DATABASE_URL)) {
      issue('DATABASE_URL', 'must set sslmode=require (or verify-full) in production');
    }
    if (isProd && !env.PUBLIC_BASE_URL.startsWith('https://')) {
      issue('PUBLIC_BASE_URL', 'must be https in production');
    }
    if (env.AUTH_MODE === 'entra') {
      for (const key of ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET'] as const) {
        if (!env[key]) issue(key, 'required when AUTH_MODE=entra');
      }
    }
    if (env.ADO_AUTH === 'pat' && !env.ADO_PAT && !env.SYNC_DISABLED) {
      issue('ADO_PAT', 'required when ADO_AUTH=pat and sync is enabled');
    }
    if (env.CHANGE_QUEUE_KIND !== 'none' && !env.CHANGE_QUEUE_URL) {
      issue('CHANGE_QUEUE_URL', 'required when CHANGE_QUEUE_KIND is set');
    }
    if (env.CHANGE_QUEUE_URL && !env.CHANGE_QUEUE_URL.startsWith('https://')) {
      issue('CHANGE_QUEUE_URL', 'must use https');
    }
    if (
      env.CHANGE_QUEUE_KIND === 'servicebus' &&
      env.CHANGE_QUEUE_URL &&
      !/^https:\/\/[^/]+\.servicebus\.windows\.net\/[^/]+\/?$/.test(env.CHANGE_QUEUE_URL)
    ) {
      issue('CHANGE_QUEUE_URL', 'must be https://<namespace>.servicebus.windows.net/<queue>');
    }
    if (Boolean(env.WEBHOOK_BASIC_USER) !== Boolean(env.WEBHOOK_BASIC_PASSWORD)) {
      issue(
        'WEBHOOK_BASIC_PASSWORD',
        'set both WEBHOOK_BASIC_USER and WEBHOOK_BASIC_PASSWORD, or neither',
      );
    }
  });

export type AppConfig = z.infer<typeof envSchema> & {
  isProduction: boolean;
  publicOrigin: string;
};

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // `KEY=` in an env file means "not set", not "set to an empty string".
  const defined = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const parsed = envSchema.safeParse(defined);
  if (!parsed.success) {
    // Only variable names and rule messages are printed, never values.
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${details}`);
  }
  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === 'production',
    publicOrigin: new URL(parsed.data.PUBLIC_BASE_URL).origin,
  };
}
