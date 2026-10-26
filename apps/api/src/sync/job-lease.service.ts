import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lease-based lock in Postgres so only one replica runs a background job at a time.
 * A crashed holder's lease simply expires; no manual cleanup is needed.
 */
@Injectable()
export class JobLeaseService {
  private readonly holder = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  constructor(private readonly prisma: PrismaService) {}

  async acquire(name: string, ttlMs: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const rows = await this.prisma.$queryRaw<{ holder: string }[]>`
      INSERT INTO job_lease (name, holder, expires_at)
      VALUES (${name}, ${this.holder}, ${expiresAt})
      ON CONFLICT (name) DO UPDATE
        SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
        WHERE job_lease.expires_at < now() OR job_lease.holder = EXCLUDED.holder
      RETURNING holder`;
    return rows.length === 1 && rows[0]!.holder === this.holder;
  }

  async release(name: string): Promise<void> {
    await this.prisma.jobLease.deleteMany({ where: { name, holder: this.holder } });
  }

  /** Runs `fn` only if the lease is acquired; returns undefined when another replica holds it. */
  async runExclusive<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
    if (!(await this.acquire(name, ttlMs))) return undefined;
    try {
      return await fn();
    } finally {
      await this.release(name);
    }
  }
}
