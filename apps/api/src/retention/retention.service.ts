import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APP_CONFIG, AppConfig } from '../config/config';
import { DAY_MS } from '../metrics/engine/stats';
import { PrismaService } from '../prisma/prisma.service';
import { JobLeaseService } from '../sync/job-lease.service';
import { AuditService } from '../audit/audit.service';

const SYNC_RUN_RETENTION_DAYS = 90;

/**
 * Enforces the data retention policy (RETENTION_DAYS, default 2 years) once a day:
 * work items untouched for longer than the window (with all derived rows and delay reasons),
 * audit entries older than the window, old sync runs and expired sessions.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lease: JobLeaseService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Cron('15 3 * * *', { name: 'retention', timeZone: 'UTC' })
  async scheduled(): Promise<void> {
    await this.lease.runExclusive('retention', 60 * 60_000, () => this.purge()).catch((err) =>
      this.logger.error({ err }, 'Retention job failed'),
    );
  }

  async purge(now = new Date()) {
    const cutoff = new Date(now.getTime() - this.config.RETENTION_DAYS * DAY_MS);
    const workItems = await this.prisma.workItem.deleteMany({ where: { changedDate: { lt: cutoff } } });
    const auditRows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.allow_audit_purge = 'on'`;
      return tx.auditLog.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    });
    const syncRuns = await this.prisma.syncRun.deleteMany({
      where: { startedAt: { lt: new Date(now.getTime() - SYNC_RUN_RETENTION_DAYS * DAY_MS) } },
    });
    const sessions = await this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });

    const summary = {
      cutoff: cutoff.toISOString(),
      workItems: workItems.count,
      auditRows: auditRows.count,
      syncRuns: syncRuns.count,
      sessions: sessions.count,
    };
    await this.audit.record({ action: 'retention.purge', outcome: 'success', details: summary });
    this.logger.log(summary, 'Retention purge complete');
    return summary;
  }
}
