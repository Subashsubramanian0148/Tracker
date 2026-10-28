import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MeResponse } from '@ado-metrics/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, AppConfig } from '../config/config';
import { Public } from '../common/decorators';
import type { SessionUser } from '../common/session.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, randomToken, safeReturnTo, SignInError } from './auth.service';
import { DEV_USER } from './dev-personas';
import { PAGE_CSS } from './page-css';
import { isManager } from '../common/guards';

const AUTH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('login')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async login(
    @Query('returnTo') returnTo: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const target = safeReturnTo(returnTo);
    if (this.config.AUTH_MODE === 'dev') {
      res.redirect(302, `/api/auth/dev?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    const { url, pending } = await this.auth.beginSignIn(target);
    req.session.pendingLogin = pending;
    req.session.save(() => res.redirect(302, url));
  }

  @Get('callback')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (this.config.AUTH_MODE !== 'entra') throw new NotFoundException();
    const pending = req.session.pendingLogin;
    try {
      const { user, projectIds } = await this.auth.completeSignIn(pending, {
        code: str(query.code),
        state: str(query.state),
        error: str(query.error),
      });
      await this.establishSession(req, user, projectIds);
      await this.audit.record({
        action: 'auth.login',
        outcome: 'success',
        actor: user,
        req,
        details: { projects: projectIds.length },
      });
      res.redirect(302, pending?.returnTo ?? '/');
    } catch (err) {
      const reason = err instanceof SignInError ? err.reason : 'idp_error';
      await this.audit.record({
        action: 'auth.login',
        outcome: reason === 'not_member' ? 'denied' : 'error',
        req,
        details: { reason },
      });
      req.session.pendingLogin = undefined;
      res
        .status(reason === 'not_member' ? 403 : 401)
        .type('html')
        .send(
          reason === 'not_member'
            ? page(
                'Company accounts only',
                'DesignFlow is an internal site. Sign in with your company work account.',
              )
            : page('Sign-in failed', 'We could not sign you in. Please try again.'),
        );
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const user = req.session.user;
    await this.audit.record({ action: 'auth.logout', outcome: 'success', actor: user, req });
    const cookieName = this.config.isProduction ? '__Host-adom.sid' : 'adom.sid';
    req.session.destroy(() => {
      res.clearCookie(cookieName, {
        path: '/',
        httpOnly: true,
        secure: this.config.isProduction,
        sameSite: 'lax',
      });
      res.json({ logoutUrl: this.auth.logoutUrl() });
    });
  }

  @Get('me')
  async me(@Req() req: Request): Promise<MeResponse> {
    const user = req.session.user!;
    if (!req.session.csrfToken) req.session.csrfToken = randomToken();
    const projects = await this.prisma.project.findMany({
      where: isManager(user.roles) ? {} : { id: { in: req.session.projectIds ?? [] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { user, csrfToken: req.session.csrfToken, projects, authMode: this.config.AUTH_MODE };
  }

  // ---- Local development only ----------------------------------------------------------

  /** Local development: no chooser, sign straight in as the one dev user. */
  @Get('dev')
  @Public()
  devEntry(@Query('returnTo') returnTo: unknown, @Req() req: Request, @Res() res: Response): void {
    this.assertDevMode(req);
    res.redirect(302, `/api/auth/dev/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
  }

  @Get('page.css')
  @Public()
  pageCss(@Res() res: Response): void {
    res.type('text/css').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(PAGE_CSS);
  }

  @Get('dev/login')
  @Public()
  async devLogin(
    @Query('returnTo') returnTo: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.assertDevMode(req);
    const user = DEV_USER;
    const projects = await this.prisma.project.findMany({ select: { id: true } });
    await this.establishSession(
      req,
      user,
      projects.map((p) => p.id),
    );
    await this.audit.record({
      action: 'auth.login',
      outcome: 'success',
      actor: user,
      req,
      details: { mode: 'dev' },
    });
    res.redirect(302, safeReturnTo(returnTo));
  }

  /** Passwordless, so only for requests from this machine (the socket address, not X-Forwarded-For). */
  private assertDevMode(req: Request) {
    const from = req.socket.remoteAddress ?? '';
    const local = from === '::1' || from.startsWith('127.') || from.startsWith('::ffff:127.');
    if (this.config.AUTH_MODE !== 'dev' || this.config.isProduction || !local)
      throw new NotFoundException();
  }

  /** New session id on every sign-in prevents session fixation. */
  private establishSession(req: Request, user: SessionUser, projectIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.user = user;
        req.session.projectIds = projectIds;
        req.session.authenticatedAt = Date.now();
        req.session.csrfToken = randomToken();
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      });
    });
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length <= 4096 ? v : undefined;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Minimal static page: no scripts or inline styles, so it satisfies the strict CSP. */
/** Server-rendered auth pages share the app's look via a same-origin stylesheet (the CSP forbids inline styles). */
function page(
  title: string,
  bodyHtml: string,
  opts: { retry?: boolean; badge?: string } = {},
): string {
  const retry = opts.retry ?? true;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · DesignFlow</title><link rel="stylesheet" href="/api/auth/page.css"></head><body><main class="card"><div class="brand"><svg class="logo" aria-hidden="true" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#FDE4DA"/><g transform="translate(7 7) scale(0.75)" fill="none" stroke="#E4572E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/></g></svg>DesignFlow</div>${opts.badge ? `<p class="badge">${escapeHtml(opts.badge)}</p>` : ''}<h1>${escapeHtml(title)}</h1>${bodyHtml.startsWith('<') ? bodyHtml : `<p class="lead">${bodyHtml}</p>`}${retry ? '<p><a class="button" href="/api/auth/login">Sign in again</a></p>' : ''}</main></body></html>`;
}
