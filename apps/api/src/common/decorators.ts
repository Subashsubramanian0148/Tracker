import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@ado-metrics/shared';
import type { Request } from 'express';
import type { SessionUser } from './session.types';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const SKIP_CSRF = 'skipCsrf';

/** Route needs no signed-in user (health, login, webhook with its own auth). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route requires at least one of these roles. Manager implicitly passes every role check. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Route authenticates by other means (e.g. webhook basic auth) and carries no session cookie. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest<Request>();
  // SessionAuthGuard guarantees presence on non-public routes.
  return req.session.user as SessionUser;
});

export function traceIdOf(req: Request): string {
  return String(req.id ?? '');
}
