import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, AppConfig } from '../config/config';
import { IS_PUBLIC, ROLES, SKIP_CSRF } from './decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Manager is the top of the hierarchy (Designer → Team Lead → Manager) and passes every role check. */
export function isManager(roles: readonly Role[]): boolean {
  return roles.includes('Manager') || roles.includes('Admin');
}

export function hasRole(roles: readonly Role[], ...required: Role[]): boolean {
  return isManager(roles) || required.some((r) => roles.includes(r));
}

/** Requires a signed-in session and enforces the absolute session lifetime. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const { user, authenticatedAt } = req.session ?? {};
    if (!user || !authenticatedAt) throw new UnauthorizedException();

    const maxAgeMs = this.config.SESSION_ABSOLUTE_HOURS * 3_600_000;
    if (Date.now() - authenticatedAt > maxAgeMs) {
      await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
      throw new UnauthorizedException('Session expired');
    }
    return true;
  }
}

/**
 * CSRF defence in depth for cookie-authenticated, state-changing requests:
 * 1. Origin (or Referer) must be our own origin, and
 * 2. the synchronizer token from /api/auth/me must be echoed in X-CSRF-Token.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.allowedOrigins = new Set([config.publicOrigin, ...config.ALLOWED_ORIGINS]);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }

    const origin = req.get('origin') ?? originOf(req.get('referer'));
    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Cross-origin request blocked');
    }
    const expected = req.session?.csrfToken;
    const provided = req.get('x-csrf-token');
    if (!expected || !provided || !safeEqual(expected, provided)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.session.user;
    if (user && hasRole(user.roles, ...required)) return true;

    await this.audit.record({
      action: 'authz.denied',
      outcome: 'denied',
      actor: user,
      targetType: 'route',
      targetId: `${req.method} ${req.route?.path ?? req.path}`,
      details: { required },
      req,
    });
    throw new ForbiddenException();
  }
}

/**
 * Ensures `:projectId` is a project the user may see in Azure DevOps. Unknown and forbidden
 * projects both return 404 so project ids can't be enumerated.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const projectId = req.params.projectId;
    if (typeof projectId !== 'string' || !GUID.test(projectId)) throw new NotFoundException();

    const user = req.session.user;
    if (user && (isManager(user.roles) || req.session.projectIds?.includes(projectId))) {
      return true;
    }
    await this.audit.record({
      action: 'authz.project_denied',
      outcome: 'denied',
      actor: user,
      targetType: 'project',
      targetId: projectId,
      req,
    });
    throw new NotFoundException();
  }
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
