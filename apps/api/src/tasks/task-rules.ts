import type { PersonRef, TaskCounts, TaskStatus, TaskSummary } from '@ado-metrics/shared';
import { weekStartUtc } from '../metrics/engine/stats';

export interface TaskTimes {
  status: TaskStatus;
  dueDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** Start/completion stamps follow the status: first start is kept, completion is cleared on reopen. */
export function applyStatus(
  prev: TaskTimes,
  next: TaskStatus,
  now: Date,
): Pick<TaskTimes, 'startedAt' | 'completedAt'> {
  return {
    startedAt: prev.startedAt ?? (next === 'upcoming' ? null : now),
    completedAt:
      next === 'completed' ? (prev.status === 'completed' ? prev.completedAt : now) : null,
  };
}

const dayEnd = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));

/** Late = finished after the due date, or still open once the due date has passed. */
export function isLate(
  t: Pick<TaskTimes, 'status' | 'dueDate' | 'completedAt'>,
  now: Date,
): boolean {
  if (!t.dueDate) return false;
  const deadline = dayEnd(t.dueDate);
  return t.status === 'completed' ? !!t.completedAt && t.completedAt >= deadline : now >= deadline;
}

export interface SummaryRow extends TaskTimes {
  ownerId: string;
  ownerName: string;
  createdAt: Date;
}

const OPEN_KEY: Record<Exclude<TaskStatus, 'completed'>, keyof TaskCounts> = {
  upcoming: 'upcoming',
  started: 'started',
  in_progress: 'inProgress',
  approval_pending: 'approvalPending',
  reopened: 'reopened',
};

const emptyCounts = (): TaskCounts => ({
  upcoming: 0,
  started: 0,
  inProgress: 0,
  approvalPending: 0,
  reopened: 0,
  completed: 0,
  overdue: 0,
});

/** Team view: open work per person, completions within the window, and a weekly created/completed trend. */
export function buildSummary(rows: SummaryRow[], weeks: number, now: Date): TaskSummary {
  const firstWeek = weekStartUtc(new Date(now.getTime() - (weeks - 1) * 7 * 86_400_000));
  const totals = emptyCounts();
  const people = new Map<string, TaskCounts & { owner: PersonRef }>();
  const weekly = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(firstWeek.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10),
    created: 0,
    completed: 0,
    completedLate: 0,
  }));
  const weekIndex = (d: Date) =>
    Math.floor((weekStartUtc(d).getTime() - firstWeek.getTime()) / (7 * 86_400_000));
  let doneWithDue = 0;
  let onTime = 0;

  for (const r of rows) {
    const person = people.get(r.ownerId) ?? {
      owner: { id: r.ownerId, displayName: r.ownerName },
      ...emptyCounts(),
    };
    people.set(r.ownerId, person);
    const late = isLate(r, now);
    const bump = (k: keyof TaskCounts) => {
      person[k] += 1;
      totals[k] += 1;
    };

    if (r.status === 'completed') {
      const w = r.completedAt ? weekIndex(r.completedAt) : -1;
      if (w >= 0) {
        bump('completed');
        weekly[w]!.completed += 1;
        if (late) weekly[w]!.completedLate += 1;
        if (r.dueDate) {
          doneWithDue += 1;
          if (!late) onTime += 1;
        }
      }
    } else {
      bump(OPEN_KEY[r.status]);
      if (late) bump('overdue');
    }
    const c = weekIndex(r.createdAt);
    if (c >= 0) weekly[c]!.created += 1;
  }

  return {
    totals,
    onTimeRate: doneWithDue ? onTime / doneWithDue : null,
    people: [...people.values()]
      .filter(
        (p) =>
          p.upcoming + p.started + p.inProgress + p.approvalPending + p.reopened + p.completed > 0,
      )
      .sort(
        (a, b) => b.overdue - a.overdue || a.owner.displayName.localeCompare(b.owner.displayName),
      ),
    weekly,
  };
}
