import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { AuditEntry, AuditListQuery, Paged } from '@ado-metrics/shared';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client';
import { traceIdOf } from '../common/decorators';
import type { SessionUser } from '../common/session.types';
import { PrismaService } from '../prisma/prisma.service';

export type AuditOutcome = 'success' | 'denied' | 'error';

export interface AuditEvent {
  action: string;
  outcome: AuditOutcome;
  actor?: Pick<SessionUser, 'id' | 'displayName'> | null;
  targetType?: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
  req?: Request;
}

/** Fixed key for the advisory lock that serialises hash-chain appends. */
const AUDIT_LOCK_KEY = 7_331_001;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an entry to the hash-chained audit log. Failures are logged but never break the
   * request that triggered them; the structured app log still records the event.
   */
  async record(event: AuditEvent): Promise<void> {
    const row = {
      occurredAt: new Date(),
      actorId: event.actor?.id ?? null,
      actorName: event.actor?.displayName ?? null,
      action: event.action,
      targetType: event.targetType ?? null,
      targetId: event.targetId === undefined ? null : String(event.targetId),
      outcome: event.outcome,
      ip: event.req ? clientIp(event.req) : null,
      userAgent: event.req?.get('user-agent')?.slice(0, 300) ?? null,
      traceId: event.req ? traceIdOf(event.req) : null,
      // Round-trip through JSON so the hash covers exactly what jsonb stores (undefined keys dropped).
      details: (event.details ? JSON.parse(JSON.stringify(event.details)) : null) as Prisma.InputJsonValue | null,
    };
    this.logger.log({ audit: { ...row, details: undefined } }, `audit ${row.action} ${row.outcome}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`;
        const last = await tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
        const prevHash = last?.hash ?? null;
        const hash = chainHash(prevHash, row);
        await tx.auditLog.create({
          data: { ...row, details: row.details ?? Prisma.DbNull, prevHash, hash },
        });
      });
    } catch (err) {
      this.logger.error({ err, action: row.action }, 'Failed to persist audit entry');
    }
  }

  async list(q: AuditListQuery): Promise<Paged<AuditEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.from || q.to
        ? {
            occurredAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id.toString(),
        occurredAt: r.occurredAt.toISOString(),
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        outcome: r.outcome as AuditEntry['outcome'],
        ip: r.ip,
        details: (r.details as Record<string, unknown> | null) ?? null,
      })),
    };
  }

  /** Recomputes the chain; returns the id of the first broken link, or null when intact. */
  async verifyChain(): Promise<string | null> {
    let prevHash: string | null = null;
    let cursor: bigint | undefined;
    for (;;) {
      const batch = await this.prisma.auditLog.findMany({
        orderBy: { id: 'asc' },
        take: 1000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) return null;
      for (const r of batch) {
        // The first surviving row may point at a purged predecessor (retention); accept its prevHash.
        const expectedPrev = prevHash ?? r.prevHash;
        const expected = chainHash(expectedPrev, {
          occurredAt: r.occurredAt,
          actorId: r.actorId,
          actorName: r.actorName,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          outcome: r.outcome,
          ip: r.ip,
          userAgent: r.userAgent,
          traceId: r.traceId,
          details: r.details as Prisma.InputJsonValue | null,
        });
        if (r.prevHash !== expectedPrev || r.hash !== expected) return r.id.toString();
        prevHash = r.hash;
      }
      cursor = batch[batch.length - 1]!.id;
    }
  }
}

interface HashableRow {
  occurredAt: Date;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  ip: string | null;
  userAgent: string | null;
  traceId: string | null;
  details: Prisma.InputJsonValue | null;
}

export function chainHash(prevHash: string | null, row: HashableRow): string {
  const canonical = JSON.stringify([
    prevHash,
    row.occurredAt.toISOString(),
    row.actorId,
    row.actorName,
    row.action,
    row.targetType,
    row.targetId,
    row.outcome,
    row.ip,
    row.userAgent,
    row.traceId,
    stableStringify(row.details),
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/** JSON with sorted keys, so jsonb key reordering in Postgres doesn't break verification. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Express resolves this from X-Forwarded-For honouring the configured trust-proxy hops. */
function clientIp(req: Request): string | null {
  return req.ip ?? null;
}
