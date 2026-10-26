import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  teamScopedQuery,
  type Iteration,
  type BoardColumnDef,
  type ProjectSummary,
  type TeamRef,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { isManager, ProjectAccessGuard } from '../common/guards';
import { ZodPipe } from '../common/zod-validation.pipe';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  async list(@Req() req: Request): Promise<ProjectSummary[]> {
    const user = req.session.user!;
    const where = isManager(user.roles) ? {} : { id: { in: req.session.projectIds ?? [] } };
    const projects = await this.prisma.project.findMany({ where, orderBy: { name: 'asc' } });
    const ids = projects.map((p) => p.id);
    const [counts, delays] = await Promise.all([
      this.prisma.workItem.groupBy({
        by: ['projectId'],
        where: { projectId: { in: ids }, isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.workItem.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: ids },
          isDeleted: false,
          isDelayed: true,
          delayReasons: { none: { supersededAt: null } },
        },
        _count: { _all: true },
      }),
    ]);
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
      workItemCount: counts.find((c) => c.projectId === p.id)?._count._all ?? 0,
      openDelayCount: delays.find((c) => c.projectId === p.id)?._count._all ?? 0,
      boardColumns: (p.boardColumns as BoardColumnDef[] | null) ?? null,
    }));
  }

  @Get(':projectId/teams')
  @UseGuards(ProjectAccessGuard)
  async teams(@Param('projectId') projectId: string): Promise<TeamRef[]> {
    return this.prisma.team.findMany({ where: { projectId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  @Get(':projectId/iterations')
  @UseGuards(ProjectAccessGuard)
  iterations(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(teamScopedQuery)) q: { teamId?: string },
  ): Promise<Iteration[]> {
    return this.metrics.iterations(projectId, q.teamId);
  }
}
