import { Store, type SessionData } from 'express-session';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Callback<T = void> = (err?: unknown, value?: T) => void;

/**
 * express-session store backed by Postgres. Sessions are server-side, so the cookie only
 * carries a signed random id; nothing about the user (and no tokens) ever reaches the browser.
 */
export class PrismaSessionStore extends Store {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fallbackTtlMs: number,
  ) {
    super();
  }

  override get(sid: string, cb: Callback<SessionData | null>): void {
    this.prisma.session
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row || row.expiresAt.getTime() <= Date.now()) return cb(null, null);
        cb(null, row.data as unknown as SessionData);
      })
      .catch((err) => cb(err));
  }

  override set(sid: string, session: SessionData, cb?: Callback): void {
    const expiresAt = this.expiry(session);
    const data = session as unknown as Prisma.InputJsonValue;
    this.prisma.session
      .upsert({ where: { sid }, create: { sid, data, expiresAt }, update: { data, expiresAt } })
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  override touch(sid: string, session: SessionData, cb?: Callback): void {
    this.prisma.session
      .updateMany({ where: { sid }, data: { expiresAt: this.expiry(session) } })
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  override destroy(sid: string, cb?: Callback): void {
    this.prisma.session
      .deleteMany({ where: { sid } })
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return count;
  }

  private expiry(session: SessionData): Date {
    const cookieExpiry = session.cookie?.expires ? new Date(session.cookie.expires) : null;
    return cookieExpiry ?? new Date(Date.now() + this.fallbackTtlMs);
  }
}
