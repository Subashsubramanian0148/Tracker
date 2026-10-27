import type { DelayFlag, StateCategory } from '@ado-metrics/shared';
import { commentDelay, type CommentInput } from './comment-signals';
import { DAY_MS, hoursBetween } from './stats';

/** Work item types that represent deliverable work (delay detection & sprint health). */
export const DELIVERY_TYPES: ReadonlySet<string> = new Set([
  'Product Backlog Item',
  'User Story',
  'Requirement',
  // Basic process backlog item.
  'Issue',
  'Bug',
  'Task',
]);

/** Types that are committed to sprints (tasks are excluded from sprint commitment counts). */
export const BACKLOG_TYPES: ReadonlySet<string> = new Set([
  'Product Backlog Item',
  'User Story',
  'Requirement',
  'Issue',
  'Bug',
]);

export interface SprintWindow {
  path: string;
  startDate: Date;
  finishDate: Date;
}

export interface DelayInput {
  type: string;
  stateCategory: StateCategory;
  iterationPath: string | null;
  activatedDate: Date | null;
  completedDate: Date | null;
  cycleTimeHours: number | null;
  blockedHours: number;
  reopenCount: number;
  intervals: { iterationPath: string; enteredAt: Date; exitedAt: Date | null }[];
  /** Azure DevOps comments with their keyword signals; optional so older callers keep working. */
  comments?: readonly CommentInput[];
}

export interface DelayContext {
  now: Date;
  /** P85 cycle time (hours) per work item type over the recent baseline; undefined = not enough data. */
  p85CycleHoursByType: ReadonlyMap<string, number>;
  sprintsByPath: ReadonlyMap<string, SprintWindow>;
  blockedThresholdHours: number;
}

/** Sprint finish dates are the last working day; work moved on that day still counts as carried over. */
const CARRY_OVER_GRACE_MS = DAY_MS;

export function detectDelays(item: DelayInput, ctx: DelayContext): DelayFlag[] {
  if (!DELIVERY_TYPES.has(item.type) || item.stateCategory === 'Removed') return [];
  const flags: DelayFlag[] = [];
  const done = item.stateCategory === 'Completed';

  const p85 = ctx.p85CycleHoursByType.get(item.type);
  if (p85 !== undefined) {
    const elapsed = done
      ? item.cycleTimeHours
      : item.activatedDate
        ? hoursBetween(item.activatedDate, ctx.now)
        : null;
    if (elapsed !== null && elapsed > p85) flags.push('CYCLE_TIME_OUTLIER');
  }

  if (carriedOverCount(item, ctx) > 0) flags.push('CARRIED_OVER');

  if (!done && item.iterationPath) {
    const sprint = ctx.sprintsByPath.get(item.iterationPath);
    if (sprint && sprint.finishDate.getTime() + DAY_MS < ctx.now.getTime())
      flags.push('PAST_SPRINT_END');
  }

  if (item.blockedHours > ctx.blockedThresholdHours) flags.push('LONG_BLOCKED');
  if (item.reopenCount > 0) flags.push('REOPENED');
  if (item.comments?.length) {
    // The Blocked field is the real record; a #blocked comment only counts when the field was never used.
    const fromComments = commentDelay(item.comments, item, ctx.now).flags;
    flags.push(
      ...fromComments.filter((f) => f !== 'BLOCKED_IN_COMMENTS' || item.blockedHours === 0),
    );
  }
  return flags;
}

/** Number of sprints the item was still in, unfinished, when the sprint ended. */
export function carriedOverCount(
  item: DelayInput,
  ctx: Pick<DelayContext, 'sprintsByPath' | 'now'>,
): number {
  let count = 0;
  const seen = new Set<string>();
  for (const iv of item.intervals) {
    const sprint = ctx.sprintsByPath.get(iv.iterationPath);
    if (!sprint || seen.has(sprint.path)) continue;
    // Only sprints whose finish day is over; the current sprint can't have carried anything over yet.
    if (sprint.finishDate.getTime() + DAY_MS > ctx.now.getTime()) continue;
    const cutoff = sprint.finishDate.getTime() - CARRY_OVER_GRACE_MS;
    const coversEnd =
      iv.enteredAt.getTime() <= cutoff && (iv.exitedAt === null || iv.exitedAt.getTime() > cutoff);
    const unfinished =
      !item.completedDate || item.completedDate.getTime() > sprint.finishDate.getTime() + DAY_MS;
    const movedOn = iv.exitedAt !== null || item.stateCategory !== 'Completed';
    if (coversEnd && unfinished && movedOn) {
      count++;
      seen.add(sprint.path);
    }
  }
  return count;
}

export function sprintsSpanned(
  item: Pick<DelayInput, 'intervals'>,
  sprintsByPath: ReadonlyMap<string, SprintWindow>,
): string[] {
  const paths: string[] = [];
  for (const iv of item.intervals) {
    if (sprintsByPath.has(iv.iterationPath) && !paths.includes(iv.iterationPath))
      paths.push(iv.iterationPath);
  }
  return paths;
}
