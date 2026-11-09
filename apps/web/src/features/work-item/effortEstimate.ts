import type { WorkItemDetail } from '@ado-metrics/shared';

/** The team's rule: 1 point of effort is 4 hours, which counts as one working day. */
export const HOURS_PER_POINT = 4;
export const HOURS_PER_DAY = 4;

export interface EffortEstimate {
  points: number;
  hours: number;
  days: number;
  /** Where the points came from: the story's own Effort, or its tasks' Effort added up. */
  source: 'story' | 'tasks';
}

/** Estimated time from Effort: the story's own, or its child tasks' total when it has none. */
export function effortEstimate(item: WorkItemDetail): EffortEstimate | null {
  const fromTasks = item.children.reduce((sum, c) => sum + (c.effort ?? 0), 0);
  const points = item.effort ?? (fromTasks > 0 ? fromTasks : null);
  if (points === null || points <= 0) return null;
  const hours = points * HOURS_PER_POINT;
  return {
    points,
    hours,
    days: Math.max(1, Math.ceil(hours / HOURS_PER_DAY)),
    source: item.effort !== null ? 'story' : 'tasks',
  };
}
