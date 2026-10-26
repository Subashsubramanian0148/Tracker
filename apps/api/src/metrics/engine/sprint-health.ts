import { DAY_MS } from './stats';
import type { SprintWindow } from './delays';

export interface SprintItem {
  id: number;
  effort: number | null;
  completedDate: Date | null;
  intervals: { iterationPath: string; enteredAt: Date; exitedAt: Date | null }[];
}

export interface SprintHealthCounts {
  committedCount: number;
  committedEffort: number;
  completedCount: number;
  completedEffort: number;
  addedMidSprint: number;
  removedMidSprint: number;
  carriedOver: number;
  completionRate: number | null;
}

/** Items added on the first day of the sprint still count as committed (planning often runs late). */
const PLANNING_GRACE_MS = DAY_MS;

/**
 * Sprint commitment vs delivery from iteration-path history:
 * - committed: in the sprint at start (+1 day grace)
 * - added mid-sprint: entered after the grace window, before the end
 * - removed mid-sprint: left the sprint before the end without being completed
 * - completed: completed during the sprint while assigned to it
 * - completion rate: share of *committed* items completed (added work doesn't inflate it)
 * - carried over: still in the sprint at the end, not completed
 */
export function computeSprintHealth(
  sprint: SprintWindow,
  items: readonly SprintItem[],
  now: Date,
): SprintHealthCounts {
  const start = sprint.startDate.getTime();
  const commitCutoff = start + PLANNING_GRACE_MS;
  const finish = sprint.finishDate.getTime() + DAY_MS; // finish date is inclusive

  const r: SprintHealthCounts = {
    committedCount: 0,
    committedEffort: 0,
    completedCount: 0,
    completedEffort: 0,
    addedMidSprint: 0,
    removedMidSprint: 0,
    carriedOver: 0,
    completionRate: null,
  };
  let committedCompleted = 0;

  for (const item of items) {
    const ivs = item.intervals.filter((iv) => iv.iterationPath === sprint.path);
    if (ivs.length === 0) continue;
    const effort = item.effort ?? 0;
    const doneAt = item.completedDate?.getTime() ?? null;
    const inSprintAt = (t: number) =>
      ivs.some(
        (iv) => iv.enteredAt.getTime() <= t && (iv.exitedAt === null || iv.exitedAt.getTime() > t),
      );

    const committed = inSprintAt(commitCutoff) && (doneAt === null || doneAt >= start);
    const added = !committed && addedAt(sprint, ivs) !== null;
    if (!committed && !added) continue;

    if (committed) {
      r.committedCount++;
      r.committedEffort += effort;
    } else {
      r.addedMidSprint++;
    }

    // Completing and moving out in the same revision still counts for this sprint.
    const completedInSprint =
      doneAt !== null &&
      doneAt >= start &&
      doneAt < finish &&
      (inSprintAt(doneAt) || inSprintAt(doneAt - 1));
    if (completedInSprint) {
      r.completedCount++;
      r.completedEffort += effort;
      if (committed) committedCompleted++;
      continue;
    }

    const lastExit = Math.max(
      ...ivs.map((iv) => iv.exitedAt?.getTime() ?? Number.POSITIVE_INFINITY),
    );
    if (lastExit < finish) r.removedMidSprint++;
    else if (now.getTime() >= finish) r.carriedOver++;
  }

  r.completionRate = r.committedCount > 0 ? committedCompleted / r.committedCount : null;
  return r;
}

/**
 * When an item joined the sprint after it started (past the planning grace), or null if it was
 * committed or never added. Takes the item's intervals for this sprint only.
 */
export function addedAt(
  sprint: SprintWindow,
  ivs: readonly { enteredAt: Date; exitedAt: Date | null }[],
): Date | null {
  const commitCutoff = sprint.startDate.getTime() + PLANNING_GRACE_MS;
  const finish = sprint.finishDate.getTime() + DAY_MS;
  const inAtCutoff = ivs.some(
    (iv) =>
      iv.enteredAt.getTime() <= commitCutoff &&
      (iv.exitedAt === null || iv.exitedAt.getTime() > commitCutoff),
  );
  if (inAtCutoff) return null;
  const entries = ivs
    .map((iv) => iv.enteredAt)
    .filter((t) => t.getTime() > commitCutoff && t.getTime() < finish)
    .sort((a, b) => a.getTime() - b.getTime());
  return entries[0] ?? null;
}
