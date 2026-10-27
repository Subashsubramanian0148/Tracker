import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DelayFlag } from '@ado-metrics/shared';
import type { RevisionSnapshot } from '../ado/fields';
import { APP_CONFIG, AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { commentDelay } from './engine/comment-signals';
import { detectDelays, type SprintWindow } from './engine/delays';
import { analyzeHistory, type CategoryResolver } from './engine/history';
import { DAY_MS, percentile } from './engine/stats';
import { buildCategoryResolver } from './state-categories';

export interface LatestText {
  rev: number;
  description: string | null;
  acceptanceCriteria: string | null;
}

const CHUNK = 50;
const BASELINE_DAYS = 180;
const MIN_BASELINE_SAMPLE = 5;

/**
 * Rebuilds a work item's current state and all derived rows (segments, iteration intervals,
 * changes, metrics) from its stored revisions, then re-evaluates delay flags project-wide.
 */
@Injectable()
export class WorkItemProcessor {
  private readonly logger = new Logger(WorkItemProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async categoryResolver(projectId: string): Promise<CategoryResolver> {
    const rows = await this.prisma.workItemTypeState.findMany({ where: { projectId } });
    return buildCategoryResolver(rows);
  }

  async processItems(
    projectId: string,
    ids: readonly number[],
    latestText = new Map<number, LatestText>(),
  ) {
    const categoryOf = await this.categoryResolver(projectId);
    const now = new Date();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const revisions = await this.prisma.workItemRevision.findMany({
        where: { workItemId: { in: chunk } },
        orderBy: [{ workItemId: 'asc' }, { rev: 'asc' }],
      });
      const byItem = new Map<number, typeof revisions>();
      for (const r of revisions) {
        const list = byItem.get(r.workItemId) ?? [];
        list.push(r);
        byItem.set(r.workItemId, list);
      }

      await this.prisma.$transaction(
        async (tx) => {
          for (const [id, revs] of byItem) {
            const inputs = revs.map((r) => ({
              rev: r.rev,
              changedDate: r.changedDate,
              changedById: r.changedById,
              snapshot: r.fields as unknown as RevisionSnapshot,
            }));
            const h = analyzeHistory(inputs, categoryOf, now);
            const latest = inputs[inputs.length - 1]!;
            const s = latest.snapshot;
            const text = latestText.get(id);
            const textFields =
              text && text.rev === latest.rev
                ? { description: text.description, acceptanceCriteria: text.acceptanceCriteria }
                : {};

            const data = {
              projectId,
              type: s.type,
              title: s.title,
              state: s.state,
              stateCategory: categoryOf(s.type, s.state),
              reason: s.reason,
              assignedToId: s.assignedTo?.id ?? null,
              iterationPath: s.iterationPath,
              areaPath: s.areaPath,
              parentId: s.parentId,
              tags: s.tags,
              effort: s.effort,
              originalEstimate: s.originalEstimate,
              remainingWork: s.remainingWork,
              completedWork: s.completedWork,
              createdDate: h.createdDate,
              changedDate: latest.changedDate,
              rev: latest.rev,
              isDeleted: s.isDeleted,
              boardColumn: s.boardColumn ?? null,
              activatedDate: h.activatedDate,
              completedDate: h.completedDate,
              cycleTimeHours: h.cycleTimeHours,
              leadTimeHours: h.leadTimeHours,
              blockedHours: h.blockedHours,
              reopenCount: h.reopenCount,
              initialEffort: h.initialEffort,
              initialRemaining: h.initialRemaining,
              metricsComputedAt: now,
              ...textFields,
            };
            await tx.workItem.upsert({ where: { id }, create: { id, ...data }, update: data });

            await tx.stateSegment.deleteMany({ where: { workItemId: id } });
            await tx.iterationInterval.deleteMany({ where: { workItemId: id } });
            await tx.workItemChange.deleteMany({ where: { workItemId: id } });
            await tx.stateSegment.createMany({
              data: h.segments.map((seg) => ({ workItemId: id, projectId, ...seg })),
            });
            await tx.iterationInterval.createMany({
              data: h.intervals.map((iv) => ({ workItemId: id, projectId, ...iv })),
            });
            await tx.workItemChange.createMany({
              data: h.changes.map((c) => ({ workItemId: id, projectId, ...c })),
            });
          }
        },
        { timeout: 60_000 },
      );
    }
  }

  /** Re-evaluates delay flags for every open or recently completed item in the project. */
  async recomputeDelays(projectId: string, now = new Date()): Promise<number> {
    const since = new Date(now.getTime() - BASELINE_DAYS * DAY_MS);

    const baseline = await this.prisma.workItem.findMany({
      where: {
        projectId,
        isDeleted: false,
        completedDate: { gte: since },
        cycleTimeHours: { not: null },
      },
      select: { type: true, cycleTimeHours: true },
    });
    const byType = new Map<string, number[]>();
    for (const b of baseline) {
      const list = byType.get(b.type) ?? [];
      list.push(b.cycleTimeHours!);
      byType.set(b.type, list);
    }
    const p85CycleHoursByType = new Map<string, number>();
    for (const [type, values] of byType) {
      if (values.length >= MIN_BASELINE_SAMPLE) {
        p85CycleHoursByType.set(
          type,
          percentile(
            values.sort((a, b) => a - b),
            0.85,
          )!,
        );
      }
    }

    const iterations = await this.prisma.iteration.findMany({
      where: { projectId, startDate: { not: null }, finishDate: { not: null } },
    });
    const sprintsByPath = new Map<string, SprintWindow>(
      iterations.map((it) => [
        it.path,
        { path: it.path, startDate: it.startDate!, finishDate: it.finishDate! },
      ]),
    );

    const items = await this.prisma.workItem.findMany({
      where: {
        projectId,
        isDeleted: false,
        OR: [{ completedDate: null }, { completedDate: { gte: since } }],
      },
      select: {
        id: true,
        type: true,
        stateCategory: true,
        iterationPath: true,
        activatedDate: true,
        completedDate: true,
        cycleTimeHours: true,
        blockedHours: true,
        reopenCount: true,
        isDelayed: true,
        delayFlags: true,
        delayDetectedAt: true,
        commentDelayHours: true,
        comments: { select: { commentId: true, createdAt: true, signals: true } },
        signalOverrides: { select: { commentId: true } },
        dismissal: { select: { workItemId: true } },
        intervals: { select: { iterationPath: true, enteredAt: true, exitedAt: true } },
      },
    });

    let changed = 0;
    const updates: {
      id: number;
      flags: DelayFlag[];
      delayed: boolean;
      detectedAt: Date | null;
      commentDelayHours: number;
    }[] = [];
    for (const raw of items) {
      // Comments someone marked "not a real signal" count as plain comments.
      const ignored = new Set(raw.signalOverrides.map((o) => o.commentId));
      const item = {
        ...raw,
        comments: raw.comments.map((c) => (ignored.has(c.commentId) ? { ...c, signals: [] } : c)),
      };
      const commentHours = Math.round(
        commentDelay(
          item.comments,
          { stateCategory: item.stateCategory as never, completedDate: item.completedDate },
          now,
        ).hours,
      );
      const flags = detectDelays(
        { ...item, stateCategory: item.stateCategory as never },
        {
          now,
          p85CycleHoursByType,
          sprintsByPath,
          blockedThresholdHours: this.config.DELAY_BLOCKED_HOURS,
        },
      );
      const same =
        flags.length === item.delayFlags.length && flags.every((f) => item.delayFlags.includes(f));
      const delayed = flags.length > 0 && !item.dismissal;
      if (same && delayed === item.isDelayed && commentHours === Math.round(item.commentDelayHours))
        continue;
      updates.push({
        id: item.id,
        flags,
        delayed,
        detectedAt: flags.length === 0 ? null : (item.delayDetectedAt ?? now),
        commentDelayHours: commentHours,
      });
    }
    for (let i = 0; i < updates.length; i += 200) {
      const batch = updates.slice(i, i + 200);
      await this.prisma.$transaction(
        batch.map((u) =>
          this.prisma.workItem.update({
            where: { id: u.id },
            data: {
              delayFlags: u.flags,
              isDelayed: u.delayed,
              delayDetectedAt: u.detectedAt,
              commentDelayHours: u.commentDelayHours,
            },
          }),
        ),
      );
      changed += batch.length;
    }
    this.logger.log({ projectId, evaluated: items.length, changed }, 'Delay flags recomputed');
    return changed;
  }
}
