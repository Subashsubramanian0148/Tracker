import { randomBytes } from 'node:crypto';
import { ConfidentialClientApplication, CryptoProvider, LogLevel } from '@azure/msal-node';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ROLES, type Role } from '@ado-metrics/shared';
import { AdoClient, ADO_RESOURCE } from '../ado/ado.client';
import { APP_CONFIG, AppConfig } from '../config/config';
import { safeEqual } from '../common/guards';
import type { PendingLogin, SessionUser } from '../common/session.types';
import { PrismaService } from '../prisma/prisma.service';

const LOGIN_SCOPES = ['openid', 'profile', 'email', `${ADO_RESOURCE}/user_impersonation`];
/** A pending sign-in must complete within this window. */
const LOGIN_TTL_MS = 10 * 60_000;

export class SignInError extends Error {
  constructor(
    message: string,
    public readonly reason: 'invalid_state' | 'expired' | 'idp_error' | 'invalid_token' | 'no_role',
  ) {
    super(message);
  }
}

export interface SignInResult {
  user: SessionUser;
  projectIds: string[];
}

/** Entra ID (OIDC authorization code + PKCE) using MSAL, Microsoft's supported library. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly msal: ConfidentialClientApplication | null;
  private readonly crypto = new CryptoProvider();
  private readonly redirectUri: string;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly ado: AdoClient,
    private readonly prisma: PrismaService,
  ) {
    this.redirectUri = `${config.publicOrigin}/api/auth/callback`;
    this.msal =
      config.AUTH_MODE === 'entra'
        ? new ConfidentialClientApplication({
            auth: {
              clientId: config.ENTRA_CLIENT_ID!,
              authority: `https://login.microsoftonline.com/${config.ENTRA_TENANT_ID}`,
              clientSecret: config.ENTRA_CLIENT_SECRET!,
            },
            system: {
              loggerOptions: {
                piiLoggingEnabled: false,
                logLevel: LogLevel.Warning,
                loggerCallback: (_level, message) => this.logger.warn(message),
              },
            },
          })
        : null;
  }

  async beginSignIn(returnTo: string): Promise<{ url: string; pending: PendingLogin }> {
    const { verifier, challenge } = await this.crypto.generatePkceCodes();
    const pending: PendingLogin = {
      state: randomToken(),
      nonce: randomToken(),
      codeVerifier: verifier,
      returnTo,
      startedAt: Date.now(),
    };
    const url = await this.msal!.getAuthCodeUrl({
      scopes: LOGIN_SCOPES,
      redirectUri: this.redirectUri,
      responseMode: 'query',
      state: pending.state,
      nonce: pending.nonce,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    return { url, pending };
  }

  async completeSignIn(
    pending: PendingLogin | undefined,
    params: { code?: string; state?: string; error?: string },
  ): Promise<SignInResult> {
    if (params.error)
      throw new SignInError(`Identity provider returned ${params.error}`, 'idp_error');
    if (!pending || !params.state || !params.code || !safeEqual(pending.state, params.state)) {
      throw new SignInError('State mismatch', 'invalid_state');
    }
    if (Date.now() - pending.startedAt > LOGIN_TTL_MS)
      throw new SignInError('Sign-in expired', 'expired');

    const result = await this.msal!.acquireTokenByCode({
      code: params.code,
      scopes: LOGIN_SCOPES,
      redirectUri: this.redirectUri,
      codeVerifier: pending.codeVerifier,
    });
    // Tokens are used once below and then dropped from MSAL's in-memory cache.
    if (result.account) await this.msal!.getTokenCache().removeAccount(result.account);

    const claims = (result.idTokenClaims ?? {}) as Record<string, unknown>;
    if (
      claims.nonce !== pending.nonce ||
      claims.tid !== this.config.ENTRA_TENANT_ID ||
      claims.aud !== this.config.ENTRA_CLIENT_ID
    ) {
      throw new SignInError('ID token validation failed', 'invalid_token');
    }
    const oid = typeof claims.oid === 'string' ? claims.oid : null;
    if (!oid) throw new SignInError('ID token has no oid', 'invalid_token');

    const roles = (Array.isArray(claims.roles) ? claims.roles : []).filter((r): r is Role =>
      (ROLES as readonly unknown[]).includes(r),
    );
    // There is no separate Admin level any more: an Entra 'Admin' assignment signs in as Manager.
    const normalised = [...new Set(roles.map((r): Role => (r === 'Admin' ? 'Manager' : r)))];
    roles.splice(0, roles.length, ...normalised);
    if (roles.length === 0) throw new SignInError('No application role assigned', 'no_role');

    const email = String(claims.preferred_username ?? claims.email ?? '').toLowerCase();
    const user: SessionUser = {
      id: oid,
      displayName: String(claims.name ?? email).slice(0, 200),
      email,
      roles,
    };

    let projectIds: string[] = [];
    try {
      projectIds = await this.ado.listProjectsForUser(result.accessToken);
    } catch (err) {
      // e.g. the user has no Azure DevOps licence: they can sign in but see no projects.
      this.logger.warn({ err, userId: oid }, 'Could not resolve Azure DevOps projects for user');
    }

    await this.prisma.appUser.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        lastLoginAt: new Date(),
      },
      update: { displayName: user.displayName, email: user.email, lastLoginAt: new Date() },
    });
    return { user, projectIds };
  }

  logoutUrl(): string | null {
    if (this.config.AUTH_MODE !== 'entra') return null;
    const url = new URL(
      `https://login.microsoftonline.com/${this.config.ENTRA_TENANT_ID}/oauth2/v2.0/logout`,
    );
    url.searchParams.set('post_logout_redirect_uri', this.config.publicOrigin);
    return url.toString();
  }
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only same-origin relative paths are allowed as post-login redirects (no open redirect). */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return '/';
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\r\n]/.test(value)
  )
    return '/';
  if (value.startsWith('/api/')) return '/';
  return value;
}
