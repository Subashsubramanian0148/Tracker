import { WorkItemProcessor } from '../metrics/work-item-processor.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SCOPE_CHANGE_KINDS,
  type ChangeKind,
  type Paged,
  type StateCategory,
  type WorkItemDetail,
  type CommentSignal,
  type WorkItemListQuery,
  type WorkItemSummary,
} from '@ado-metrics/shared';
import { AdoClient } from '../ado/ado.client';
import { ScopeService, type PersonVisibility } from '../common/scope.service';
import type { SessionUser } from '../common/session.types';
import type { Prisma } from '../generated/prisma/client';
import { sprintsSpanned, type SprintWindow } from '../metrics/engine/delays';
import { round } from '../metrics/engine/stats';
import { PrismaService } from '../prisma/prisma.service';
import { toDelayReason, toSummary, type WorkItemRow } from './mappers';
import { SPRINT_SEPARATOR } from './mappers';

const SORT_FIELD = {
  changedDate: 'changedDate',
  cycleTime: 'cycleTimeHours',
  leadTime: 'leadTimeHours',
  id: 'id',
} as const;

/** Prisma only accepts `nulls` ordering on nullable columns. */
const NULLABLE_SORT = new Set<string>(['cycleTimeHours', 'leadTimeHours']);

function sortBy(field: string, order: 'asc' | 'desc'): Prisma.WorkItemOrderByWithRelationInput {
  return { [field]: NULLABLE_SORT.has(field) ? { sort: order, nulls: 'last' } : order };
}

const SCOPE_KINDS: ReadonlySet<string> = new Set(SCOPE_CHANGE_KINDS);

const CURRENT_REASON_COUNT = {
  _count: { select: { delayReasons: { where: { supersededAt: null } } } },
} as const;

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly ado: AdoClient,
    private readonly processor: WorkItemProcessor,
  ) {}

  async list(
    projectId: string,
    q: WorkItemListQuery,
    user: SessionUser,
  ): Promise<Paged<WorkItemSummary>> {
    const searchId = q.search && /^\d{1,10}$/.test(q.search) ? Number(q.search) : null;
    const where: Prisma.WorkItemWhereInput = {
      AND: [
        { projectId, isDeleted: false },
        q.stateCategory
          ? { stateCategory: q.stateCategory }
          : { stateCategory: { not: 'Removed' } },
        q.type ? { type: q.type } : {},
        q.iterationPath
          ? {
              OR: [
                { iterationPath: q.iterationPath },
                // Children with no sprint of their own count in their parent's sprint.
                {
                  parentIterationPath: q.iterationPath,
                  iterationPath: { not: { contains: SPRINT_SEPARATOR } },
                },
              ],
            }
          : {},
        q.delayed === undefined ? {} : { isDelayed: q.delayed },
        q.search
          ? {
              OR: [
                { title: { contains: q.search, mode: 'insensitive' } },
                ...(searchId ? [{ id: searchId }] : []),
              ],
            }
          : {},
        await this.scope.teamWhere(projectId, q.teamId),
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.workItem.count({ where }),
      this.prisma.workItem.findMany({
        where,
        include: CURRENT_REASON_COUNT,
        orderBy: [sortBy(SORT_FIELD[q.sort], q.order), { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: await this.summaries(projectId, rows, user),
    };
  }

  async summaries(
    projectId: string,
    rows: (WorkItemRow & { assignedToId: string | null; _count: { delayReasons: number } })[],
    user: SessionUser,
    visibility?: PersonVisibility,
  ): Promise<WorkItemSummary[]> {
    const [people, sprints, vis] = await Promise.all([
      this.scope.peopleById(rows.map((r) => r.assignedToId)),
      this.scope.sprints(projectId),
      visibility ? Promise.resolve(visibility) : this.scope.personVisibility(user, projectId),
    ]);
    return rows.map((r) =>
      toSummary(
        r,
        this.scope.personRef(r.assignedToId ? people.get(r.assignedToId) : null, vis),
        sprints,
        r._count.delayReasons > 0,
      ),
    );
  }

  async detail(projectId: string, id: number, user: SessionUser): Promise<WorkItemDetail> {
    const item = await this.prisma.workItem.findFirst({
      where: { id, projectId, isDeleted: false },
      include: {
        ...CURRENT_REASON_COUNT,
        project: { select: { name: true } },
        segments: { orderBy: { enteredAt: 'asc' } },
        intervals: { orderBy: { enteredAt: 'asc' } },
        changes: { orderBy: [{ changedAt: 'asc' }, { id: 'asc' }] },
        delayReasons: { include: { category: true }, orderBy: { createdAt: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        signalOverrides: { select: { commentId: true } },
        dismissal: true,
        attachments: { orderBy: { name: 'asc' } },
      },
    });
    // Same 404 for "missing" and "in another project" prevents cross-project id probing.
    if (!item) throw new NotFoundException('Work item not found');

    const children = await this.prisma.workItem.findMany({
      where: { projectId, parentId: id, isDeleted: false },
      include: CURRENT_REASON_COUNT,
      orderBy: { id: 'asc' },
      take: 200,
    });

    const vis = await this.scope.personVisibility(user, projectId);
    const people = await this.scope.peopleById([
      item.assignedToId,
      ...item.changes.map((c) => c.changedById),
    ]);
    const [summary] = await this.summaries(projectId, [item], user, vis);
    const iterations = await this.prisma.iteration.findMany({
      where: { projectId, startDate: { not: null }, finishDate: { not: null } },
    });
    const sprints = new Map<string, SprintWindow>(
      iterations.map((it) => [
        it.path,
        { path: it.path, startDate: it.startDate!, finishDate: it.finishDate! },
      ]),
    );

    const timeInState = new Map<
      string,
      { state: string; category: StateCategory; hours: number }
    >();
    for (const s of item.segments) {
      const t = timeInState.get(s.state) ?? {
        state: s.state,
        category: s.category as StateCategory,
        hours: 0,
      };
      t.hours += s.durationHours;
      timeInState.set(s.state, t);
    }

    const estimateHours = item.originalEstimate ?? item.initialRemaining;
    const ratio =
      estimateHours && estimateHours > 0 && item.completedWork !== null
        ? item.completedWork / estimateHours
        : null;

    return {
      ...summary!,
      description: item.description,
      acceptanceCriteria: item.acceptanceCriteria,
      url: this.ado.workItemUrl(item.project.name, item.id),
      stateTimeline: item.segments.map((s) => ({
        state: s.state,
        category: s.category as StateCategory,
        enteredAt: s.enteredAt.toISOString(),
        exitedAt: s.exitedAt?.toISOString() ?? null,
        durationHours: round(s.durationHours)!,
      })),
      timeInState: [...timeInState.values()].map((t) => ({ ...t, hours: round(t.hours)! })),
      changes: item.changes.map((c) => ({
        rev: c.rev,
        changedAt: c.changedAt.toISOString(),
        changedBy: this.scope.personRef(c.changedById ? people.get(c.changedById) : null, vis),
        kind: c.kind as ChangeKind,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        afterWorkStarted: c.afterWorkStarted,
        isScopeChange: c.afterWorkStarted && SCOPE_KINDS.has(c.kind),
      })),
      estimate: {
        effort: item.effort,
        initialEffort: item.initialEffort,
        originalEstimateHours: item.originalEstimate,
        completedWorkHours: item.completedWork,
        remainingWorkHours: item.remainingWork,
        estimateVsActualRatio: round(ratio),
      },
      blockedHours: round(item.blockedHours)!,
      reopenCount: item.reopenCount,
      sprintsSpanned: sprintsSpanned(item, sprints),
      delayReasons: item.delayReasons.map(toDelayReason),
      children: await this.summaries(projectId, children, user, vis),
      comments: item.comments.map((c) => ({
        id: c.commentId,
        author: this.scope.personRef(
          c.authorId
            ? { id: c.authorId, displayName: c.authorName, uniqueName: c.authorUniqueName }
            : null,
          vis,
        ),
        createdAt: c.createdAt.toISOString(),
        text: c.text,
        signals: c.signals as CommentSignal[],
        ignored: item.signalOverrides.some((o) => o.commentId === c.commentId),
      })),
      commentDelayDays: round(item.commentDelayHours / 24)!,
      dismissal: item.dismissal
        ? {
            reason: item.dismissal.reason,
            by: item.dismissal.dismissedByName,
            at: item.dismissal.createdAt.toISOString(),
          }
        : null,
      attachments: item.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        sizeBytes: a.sizeBytes,
      })),
    };
  }

  /** Marks (or un-marks) a tagged comment as not a real signal, then re-scores the project. */
  async setCommentIgnored(
    projectId: string,
    id: number,
    commentId: number,
    ignored: boolean,
    user: SessionUser,
  ) {
    await this.assertExists(projectId, id);
    if (ignored) {
      await this.prisma.commentSignalOverride.upsert({
        where: { workItemId_commentId: { workItemId: id, commentId } },
        create: {
          workItemId: id,
          commentId,
          projectId,
          ignoredById: user.id,
          ignoredByName: user.displayName,
        },
        update: {},
      });
    } else {
      await this.prisma.commentSignalOverride.deleteMany({ where: { workItemId: id, commentId } });
    }
    await this.processor.recomputeDelays(projectId);
  }

  /** Records (or clears) the team's call that the item wasn't really late. */
  async setDismissal(projectId: string, id: number, reason: string | null, user: SessionUser) {
    await this.assertExists(projectId, id);
    if (reason) {
      const data = { reason, dismissedById: user.id, dismissedByName: user.displayName };
      await this.prisma.delayDismissal.upsert({
        where: { workItemId: id },
        create: { workItemId: id, projectId, ...data },
        update: data,
      });
    } else {
      await this.prisma.delayDismissal.deleteMany({ where: { workItemId: id } });
    }
    await this.processor.recomputeDelays(projectId);
  }

  private async assertExists(projectId: string, id: number) {
    const found = await this.prisma.workItem.count({ where: { id, projectId, isDeleted: false } });
    if (!found) throw new NotFoundException('Work item not found');
  }
}
