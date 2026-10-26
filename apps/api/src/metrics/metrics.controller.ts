import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  metricsQuery,
  teamScopedQuery,
  type MetricsQuery,
  type OverviewMetrics,
  type PersonMetrics,
  type SprintHealth,
  type StorySummary,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ProjectAccessGuard } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { MetricsService } from './metrics.service';

@Controller('projects/:projectId')
@UseGuards(ProjectAccessGuard)
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
  ) {}

  @Get('metrics/overview')
  overview(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(metricsQuery)) q: MetricsQuery,
  ): Promise<OverviewMetrics> {
    return this.metrics.overview(projectId, q);
  }

  @Get('metrics/stories')
  stories(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(metricsQuery)) q: MetricsQuery,
  ): Promise<StorySummary> {
    return this.metrics.stories(projectId, q);
  }

  @Get('metrics/sprints')
  sprints(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(teamScopedQuery)) q: { teamId?: string },
  ): Promise<SprintHealth[]> {
    return this.metrics.sprints(projectId, q);
  }

  @Get('people')
  @Roles('TeamLead', 'Manager')
  async people(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(metricsQuery)) q: MetricsQuery,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<PersonMetrics[]> {
    const result = await this.metrics.people(projectId, q, user);
    // Individual metrics are sensitive: every view is recorded.
    await this.audit.record({
      action: 'people.view',
      outcome: 'success',
      actor: user,
      targetType: 'project',
      targetId: projectId,
      details: { teamId: q.teamId ?? null, people: result.length },
      req,
    });
    return result;
  }
}
