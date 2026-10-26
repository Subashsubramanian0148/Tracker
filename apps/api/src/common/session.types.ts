import type { Role } from '@ado-metrics/shared';

export interface SessionUser {
  /** Entra object id (or a fixed id in dev mode). */
  id: string;
  displayName: string;
  /** Lower-cased UPN / email. */
  email: string;
  roles: Role[];
}

export interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  startedAt: number;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    /** ADO projects this user can access (resolved with their delegated token at sign-in). */
    projectIds?: string[];
    csrfToken?: string;
    /** Epoch ms; used to enforce the absolute session lifetime. */
    authenticatedAt?: number;
    pendingLogin?: PendingLogin;
  }
}

declare module 'http' {
  interface IncomingMessage {
    /** Correlation id assigned by pino-http (see logging config). */
    id: string | number | object;
  }
}
