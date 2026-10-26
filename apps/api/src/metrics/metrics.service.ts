import { Injectable } from '@nestjs/common';
import type {
  DelayFlag,
  Iteration,
  MetricsQuery,
  OverviewMetrics,
  PersonMetrics,
  SprintHealth,
  StateCategory,
  StorySummary,
} from '@ado-metrics/shared';
import { DELAY_FLAGS, SCOPE_CHANGE_KINDS } from '@ado-metrics/shared';
import { ScopeService } from '../common/scope.service';
import type { SessionUser } from '../common/session.types';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BACKLOG_TYPES } from './engine/delays';
import { addedAt, computeSprintHealth, type SprintItem } from './engine/sprint-health';
import { DAY_MS, distribution, round, toDays, weekStartUtc } from './engine/stats';

const DEFAULT_RANGE_DAYS = 90;
const MAX_SPRINTS = 12;
/** Finished within ±20% of the estimate counts as "on target". */
const ON_TARGET_LOW = 0.8;
const ON_TARGET_HIGH = 1.2;

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Stories that were on the board during the range: created by its end and not finished before
   * it started. Stage and delay come from each story's current state.
   */
  async stories(projectId: string, q: MetricsQuery): Promise<StorySummary> {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    const teamWhere = await this.scope.teamWhere(projectId, q.teamId);
    const items = await this.prisma.workItem.findMany({
      where: {
        AND: [
          {
            projectId,
            isDeleted: false,
            type: { in: [...BACKLOG_TYPES] },
            createdDate: { lte: to },
          },
          { OR: [{ completedDate: null }, { completedDate: { gte: from } }] },
          teamWhere,
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        state: true,
        stateCategory: true,
        isDelayed: true,
        delayFlags: true,
        assignedToId: true,
      },
      orderBy: { changedDate: 'desc' },
    });
    const ids = [...new Set(items.flatMap((i) => (i.assignedToId ? [i.assignedToId] : [])))];
    const names = new Map(
      (
        await this.prisma.person.findMany({
          where: { id: { in: ids } },
          select: { id: true, displayName: true },
        })
      ).map((p) => [p.id, p] as const),
    );

    const people = new Map<string, StorySummary['people'][number]>();
    let yetToStart = 0,
      inProgress = 0,
      delivered = 0,
      delayed = 0;
    for (const i of items) {
      const done = i.stateCategory === 'Completed';
      if (done) delivered++;
      else if (i.stateCategory === 'Proposed') yetToStart++;
      else inProgress++;
      if (i.isDelayed) delayed++;
      const key = i.assignedToId ?? '';
      const row = people.get(key) ?? {
        person: names.get(key) ?? null,
        total: 0,
        open: 0,
        delivered: 0,
      };
      row.total++;
      if (done) row.delivered++;
      else row.open++;
      people.set(key, row);
    }
    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      total: items.length,
      yetToStart,
      inProgress,
      delivered,
      onTime: items.length - delayed,
      delayed,
      // Unassigned goes last so the list reads as "who holds what".
      people: [...people.values()].sort(
        (a, b) => Number(!a.person) - Number(!b.person) || b.total - a.total,
      ),
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        state: i.state,
        stateCategory: i.stateCategory as StateCategory,
        isDelayed: i.isDelayed,
        delayFlags: i.delayFlags as DelayFlag[],
        assignedTo: i.assignedToId ? (names.get(i.assignedToId) ?? null) : null,
      })),
    };
  }

  async overview(projectId: string, q: MetricsQuery): Promise<OverviewMetrics> {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    const teamWhere = await this.scope.teamWhere(projectId, q.teamId);
    const typeWhere: Prisma.WorkItemWhereInput = q.type
      ? { type: q.type }
      : { type: { in: [...BACKLOG_TYPES] } };
    const scoped: Prisma.WorkItemWhereInput = {
      AND: [{ projectId, isDeleted: false }, typeWhere, teamWhere],
    };

    const completed = await this.prisma.workItem.findMany({
      where: {
        AND: [scoped, { stateCategory: 'Completed', completedDate: { gte: from, lte: to } }],
      },
      select: {
        id: true,
        title: true,
        type: true,
        completedDate: true,
        cycleTimeHours: true,
        leadTimeHours: true,
        originalEstimate: true,
        initialRemaining: true,
        completedWork: true,
      },
    });

    const cycleDays = completed.flatMap((c) =>
      c.cycleTimeHours === null ? [] : [c.cycleTimeHours / 24],
    );
    const leadDays = completed.flatMap((c) =>
      c.leadTimeHours === null ? [] : [c.leadTimeHours / 24],
    );

    const weeks = new Map<string, number>();
    for (let w = weekStartUtc(from); w <= to; w = new Date(w.getTime() + 7 * DAY_MS))
      weeks.set(w.toISOString(), 0);
    for (const c of completed) {
      const k = weekStartUtc(c.completedDate!).toISOString();
      weeks.set(k, (weeks.get(k) ?? 0) + 1);
    }

    const ids = completed.map((c) => c.id);
    const segments = ids.length
      ? await this.prisma.stateSegment.findMany({
          where: { workItemId: { in: ids }, category: { notIn: ['Completed', 'Removed'] } },
          select: { workItemId: true, state: true, category: true, durationHours: true },
        })
      : [];
    const stateTotals = new Map<string, { category: StateCategory; hours: number }>();
    for (const s of segments) {
      const t = stateTotals.get(s.state) ?? { category: s.category as StateCategory, hours: 0 };
      t.hours += s.durationHours;
      stateTotals.set(s.state, t);
    }

    const changes = await this.prisma.workItemChange.groupBy({
      by: ['kind'],
      where: {
        projectId,
        afterWorkStarted: true,
        changedAt: { gte: from, lte: to },
        workItem: scoped,
      },
      _count: { _all: true },
    });
    const affected = await this.prisma.workItemChange.findMany({
      where: {
        projectId,
        afterWorkStarted: true,
        changedAt: { gte: from, lte: to },
        kind: { in: [...SCOPE_CHANGE_KINDS] },
        workItem: scoped,
      },
      distinct: ['workItemId'],
      select: { workItemId: true },
    });
    const changeCount = (kind: string) => changes.find((c) => c.kind === kind)?._count._all ?? 0;

    // Only additions that happened inside the period, not every add in an overlapping sprint.
    const { iterations, all: sprintItems } = await this.sprintInputs(
      projectId,
      { teamId: q.teamId },
      { from, to },
      new Date(),
    );
    const addedIds = new Set<number>();
    for (const it of iterations) {
      const sprint = { path: it.path, startDate: it.startDate!, finishDate: it.finishDate! };
      for (const item of sprintItems) {
        const at = addedAt(
          sprint,
          item.intervals.filter((iv) => iv.iterationPath === it.path),
        );
        if (at && at >= from && at <= to) addedIds.add(item.id);
      }
    }
    const addedMidSprint = addedIds.size;
    const affectedIds = new Set([...affected.map((a) => a.workItemId), ...addedIds]);

    const ratios = completed.flatMap((c) => {
      const est = c.originalEstimate ?? c.initialRemaining;
      return est && est > 0 && c.completedWork !== null ? [c.completedWork / est] : [];
    });

    const delayed = await this.prisma.workItem.findMany({
      where: {
        AND: [
          scoped,
          { isDelayed: true },
          { OR: [{ completedDate: null }, { completedDate: { gte: from, lte: to } }] },
        ],
      },
      select: {
        delayFlags: true,
        delayReasons: {
          where: { supersededAt: null },
          select: { category: { select: { id: true, name: true } } },
        },
      },
    });
    const byCategory = new Map<string, { categoryId: string; category: string; count: number }>();
    const byFlag = new Map<DelayFlag, number>();
    let explainedCount = 0;
    for (const d of delayed) {
      const reason = d.delayReasons[0];
      if (reason) {
        explainedCount++;
        const e = byCategory.get(reason.category.id) ?? {
          categoryId: reason.category.id,
          category: reason.category.name,
          count: 0,
        };
        e.count++;
        byCategory.set(reason.category.id, e);
      }
      for (const f of d.delayFlags as DelayFlag[]) byFlag.set(f, (byFlag.get(f) ?? 0) + 1);
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      cycleTime: distribution(cycleDays),
      leadTime: distribution(leadDays),
      throughput: [...weeks].map(([weekStart, count]) => ({ weekStart, count })),
      cycleTimeScatter: completed
        .filter((c) => c.cycleTimeHours !== null)
        .map((c) => ({
          workItemId: c.id,
          title: c.title,
          type: c.type,
          completedAt: c.completedDate!.toISOString(),
          cycleTimeDays: toDays(c.cycleTimeHours)!,
        })),
      timeInStateAvg: [...stateTotals].map(([state, t]) => ({
        state,
        category: t.category,
        avgHours: round(ids.length ? t.hours / ids.length : 0)!,
      })),
      scopeChanges: {
        effortChanges: changeCount('EFFORT'),
        requirementEdits: changeCount('REQUIREMENT'),
        sprintMoves: changeCount('ITERATION'),
        reassignments: changeCount('ASSIGNEE'),
        addedMidSprint,
        itemsAffected: affectedIds.size,
      },
      estimateAccuracy: {
        itemsWithEstimates: ratios.length,
        itemsCompleted: completed.length,
        avgRatio: ratios.length ? round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : null,
        onTargetPct: ratios.length
          ? round(
              ratios.filter((r) => r >= ON_TARGET_LOW && r <= ON_TARGET_HIGH).length /
                ratios.length,
            )
          : null,
      },
      delays: {
        delayedCount: delayed.length,
        explainedCount,
        byCategory: [...byCategory.values()].sort((a, b) => b.count - a.count),
        byFlag: DELAY_FLAGS.map((flag) => ({ flag, count: byFlag.get(flag) ?? 0 })),
      },
    };
  }

  async iterations(projectId: string, teamId?: string): Promise<Iteration[]> {
    const rows = await this.prisma.iteration.findMany({
      where: { projectId, ...(teamId ? { teams: { some: { teamId } } } : {}) },
      orderBy: [{ startDate: { sort: 'asc', nulls: 'last' } }, { path: 'asc' }],
    });
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      startDate: r.startDate?.toISOString() ?? null,
      finishDate: r.finishDate?.toISOString() ?? null,
      timeFrame: timeFrame(r.startDate, r.finishDate, now),
    }));
  }

  async sprints(
    projectId: string,
    q: { teamId?: string },
    window?: { from: Date; to: Date },
  ): Promise<SprintHealth[]> {
    const now = new Date();
    const { iterations, all } = await this.sprintInputs(projectId, q, window, now);
    return iterations.map((it) => {
      const health = computeSprintHealth(
        { path: it.path, startDate: it.startDate!, finishDate: it.finishDate! },
        all,
        now,
      );
      return {
        iterationId: it.id,
        name: it.name,
        path: it.path,
        startDate: it.startDate!.toISOString(),
        finishDate: it.finishDate!.toISOString(),
        timeFrame: timeFrame(it.startDate, it.finishDate, now.getTime()),
        ...health,
        committedEffort: round(health.committedEffort)!,
        completedEffort: round(health.completedEffort)!,
        completionRate: round(health.completionRate),
      };
    });
  }

  /** Sprints overlapping the window, plus every backlog item's iteration history in them. */
  private async sprintInputs(
    projectId: string,
    q: { teamId?: string },
    window: { from: Date; to: Date } | undefined,
    now: Date,
  ) {
    if (q.teamId) await this.scope.teamWhere(projectId, q.teamId); // validates team ∈ project
    const iterations = await this.prisma.iteration.findMany({
      where: {
        projectId,
        startDate: { not: null, lte: window?.to ?? now },
        finishDate: { not: null, ...(window ? { gte: window.from } : {}) },
        ...(q.teamId ? { teams: { some: { teamId: q.teamId } } } : {}),
      },
      orderBy: { startDate: 'desc' },
      take: MAX_SPRINTS,
    });
    if (iterations.length === 0) return { iterations, all: [] as SprintItem[] };

    const intervals = await this.prisma.iterationInterval.findMany({
      where: {
        projectId,
        iterationPath: { in: iterations.map((i) => i.path) },
        workItem: { isDeleted: false, type: { in: [...BACKLOG_TYPES] } },
      },
      select: {
        workItemId: true,
        iterationPath: true,
        enteredAt: true,
        exitedAt: true,
        workItem: { select: { effort: true, completedDate: true } },
      },
    });
    const items = new Map<number, SprintItem>();
    for (const iv of intervals) {
      const item = items.get(iv.workItemId) ?? {
        id: iv.workItemId,
        effort: iv.workItem.effort,
        completedDate: iv.workItem.completedDate,
        intervals: [],
      };
      item.intervals.push({
        iterationPath: iv.iterationPath,
        enteredAt: iv.enteredAt,
        exitedAt: iv.exitedAt,
      });
      items.set(iv.workItemId, item);
    }
    return { iterations, all: [...items.values()] };
  }

  /** Per-person aggregates, limited to the people the viewer is allowed to see. */
  async people(projectId: string, q: MetricsQuery, user: SessionUser): Promise<PersonMetrics[]> {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    const vis = await this.scope.personVisibility(user, projectId);
    const teamWhere = await this.scope.teamWhere(projectId, q.teamId);

    const rows = await this.prisma.workItem.findMany({
      where: {
        AND: [
          {
            projectId,
            isDeleted: false,
            assignedToId: vis.all ? { not: null } : { in: [...vis.ids] },
          },
          q.type ? { type: q.type } : { type: { in: [...BACKLOG_TYPES, 'Task'] } },
          teamWhere,
          {
            OR: [
              { completedDate: { gte: from, lte: to } },
              { stateCategory: { in: ['InProgress', 'Resolved'] } },
            ],
          },
        ],
      },
      select: {
        assignedToId: true,
        stateCategory: true,
        cycleTimeHours: true,
        isDelayed: true,
        originalEstimate: true,
        initialRemaining: true,
        completedWork: true,
      },
    });

    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const g = groups.get(r.assignedToId!) ?? [];
      g.push(r);
      groups.set(r.assignedToId!, g);
    }
    const people = await this.scope.peopleById(groups.keys());

    return [...groups]
      .map(([personId, items]) => {
        const done = items.filter((i) => i.stateCategory === 'Completed');
        const ratios = done.flatMap((i) => {
          const est = i.originalEstimate ?? i.initialRemaining;
          return est && est > 0 && i.completedWork !== null ? [i.completedWork / est] : [];
        });
        return {
          person: this.scope.personRef(people.get(personId), vis) ?? {
            id: personId,
            displayName: 'Unknown',
          },
          completedCount: done.length,
          activeCount: items.length - done.length,
          cycleTime: distribution(
            done.flatMap((i) => (i.cycleTimeHours === null ? [] : [i.cycleTimeHours / 24])),
          ),
          delayedCount: items.filter((i) => i.isDelayed).length,
          estimateAccuracyRatio: ratios.length
            ? round(ratios.reduce((a, b) => a + b, 0) / ratios.length)
            : null,
        };
      })
      .sort((a, b) => b.completedCount - a.completedCount);
  }
}

function timeFrame(start: Date | null, finish: Date | null, now: number): Iteration['timeFrame'] {
  if (!start || !finish) return 'future';
  if (finish.getTime() + DAY_MS < now) return 'past';
  if (start.getTime() > now) return 'future';
  return 'current';
}
