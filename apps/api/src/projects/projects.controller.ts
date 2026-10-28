import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  teamScopedQuery,
  type ApiHealth,
  type HealthStatus,
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
    return this.prisma.team.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Live health: database round trip, sync runs over the last day, and stored data counts. */
  @Get(':projectId/health')
  @UseGuards(ProjectAccessGuard)
  async health(@Param('projectId') projectId: string): Promise<ApiHealth> {
    const now = Date.now();
    const t = performance.now();
    const dbLatency = await this.prisma.$queryRaw`SELECT 1`.then(
      () => Math.round(performance.now() - t),
      () => null,
    );
    const since = new Date(now - 24 * 3600_000);
    const forProject = { OR: [{ projectId }, { projectId: null }] };
    const [project, runs, recent, workItems, revisions, comments, lastOk] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId }, select: { lastSyncedAt: true } }),
      this.prisma.syncRun.findMany({
        where: { ...forProject, startedAt: { gte: since } },
        select: { status: true, startedAt: true, finishedAt: true },
      }),
      this.prisma.syncRun.findMany({
        where: forProject,
        orderBy: { startedAt: 'desc' },
        take: 12,
      }),
      this.prisma.workItem.count({ where: { projectId, isDeleted: false } }),
      this.prisma.workItemRevision.count({ where: { workItem: { projectId } } }),
      this.prisma.workItemComment.count({ where: { workItem: { projectId } } }),
      this.prisma.syncRun.findFirst({
        where: { ...forProject, status: 'succeeded' },
        orderBy: { startedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ]);
    const failed = runs.filter((r) => r.status === 'failed').length;
    const durations = runs
      .filter((r) => r.finishedAt)
      .map((r) => r.finishedAt!.getTime() - r.startedAt.getTime());
    const latest = recent.find((r) => r.status !== 'running');
    // Azure DevOps is "down" when the latest run failed, "degraded" when some recent runs did.
    const ado: HealthStatus =
      latest?.status === 'failed' ? 'down' : failed > 0 ? 'degraded' : latest ? 'ok' : 'degraded';
    return {
      checkedAt: new Date(now).toISOString(),
      api: {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        version: process.env.npm_package_version ?? null,
      },
      database: {
        status: dbLatency === null ? 'down' : dbLatency > 250 ? 'degraded' : 'ok',
        latencyMs: dbLatency,
      },
      azureDevOps: { status: ado, lastSuccessAt: lastOk?.finishedAt?.toISOString() ?? null },
      sync: {
        lastSyncedAt: project?.lastSyncedAt?.toISOString() ?? null,
        runsLast24h: runs.length,
        failedLast24h: failed,
        avgDurationMs: durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
        // Short and single-line, so no stack or long payload reaches the page.
        lastError:
          recent
            .find((r) => r.error)
            ?.error?.split('\n')[0]
            ?.slice(0, 160) ?? null,
      },
      data: { workItems, revisions, comments },
      recentRuns: recent.map((r) => ({
        startedAt: r.startedAt.toISOString(),
        status: r.status,
        durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
        items: r.itemsUpserted,
        trigger: r.trigger,
      })),
    };
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
