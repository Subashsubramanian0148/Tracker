import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  paginationQuery,
  triggerSyncBody,
  type Paged,
  type SyncRun,
  type TriggerSyncBody,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, AppConfig } from '../config/config';
import { CurrentUser, Public, Roles, SkipCsrf } from '../common/decorators';
import { safeEqual } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { projectIdFromServiceHook } from './service-hook';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Controller('admin')
@Roles('Admin')
export class AdminSyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('sync-runs')
  list(
    @Query(new ZodPipe(paginationQuery)) q: { page: number; pageSize: number },
  ): Promise<Paged<SyncRun>> {
    return this.sync.listRuns(q.page, q.pageSize);
  }

  @Post('sync')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async trigger(
    @Body(new ZodPipe(triggerSyncBody)) body: TriggerSyncBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<SyncRun> {
    if (this.config.SYNC_DISABLED)
      throw new ConflictException('Sync is disabled in this environment');
    const started = await this.sync.start('manual', body);
    await this.audit.record({
      action: 'sync.trigger',
      outcome: started ? 'success' : 'denied',
      actor: user,
      targetType: 'project',
      targetId: body.projectId ?? 'all',
      details: { full: body.full, reason: started ? undefined : 'already running' },
      req,
    });
    if (!started) throw new ConflictException('A sync is already running');
    void started.done.catch(() => undefined);
    return started.run;
  }
}

/**
 * Optional HTTP receiver for ADO service hooks (when the app is reachable from ADO, e.g. via
 * Front Door + WAF). Authenticated with HTTP Basic credentials configured on the subscription.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly scheduler: SyncScheduler,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('ado')
  @Public()
  @SkipCsrf()
  @HttpCode(202)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  receive(@Req() req: Request, @Body() body: unknown): { accepted: boolean } {
    const { WEBHOOK_BASIC_USER: user, WEBHOOK_BASIC_PASSWORD: pass } = this.config;
    if (!user || !pass) throw new NotFoundException();

    const header = req.get('authorization') ?? '';
    const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    if (!safeEqual(header, expected)) throw new UnauthorizedException();

    const projectId = projectIdFromServiceHook(body);
    if (projectId) this.scheduler.notifyProjectChanged(projectId);
    return { accepted: projectId !== null };
  }
}
