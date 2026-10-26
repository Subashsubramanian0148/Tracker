import type { ChangeKind, DelayFlag, StateCategory } from '@ado-metrics/shared';

export const DELAY_FLAG_LABELS: Record<DelayFlag, string> = {
  CYCLE_TIME_OUTLIER: 'Took longer than usual',
  CARRIED_OVER: 'Carried over',
  PAST_SPRINT_END: 'Past sprint end',
  LONG_BLOCKED: 'Blocked a long time',
  REOPENED: 'Reopened',
  REOPENED_IN_COMMENTS: 'Reopened in comments',
  BLOCKED_IN_COMMENTS: 'Blocked in comments',
  DONE_NOT_CLOSED: 'Done but not closed',
};

export function delayFlagLabel(flag: string): string {
  return (DELAY_FLAG_LABELS as Record<string, string>)[flag] ?? flag;
}

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  STATE: 'State',
  EFFORT: 'Effort',
  REQUIREMENT: 'Requirement',
  ASSIGNEE: 'Assignee',
  ITERATION: 'Sprint',
  BLOCKED: 'Blocked',
  OTHER: 'Other',
};

export const STATE_CATEGORY_LABELS: Record<StateCategory, string> = {
  Proposed: 'To do',
  InProgress: 'In progress',
  Resolved: 'Resolved',
  Completed: 'Done',
  Removed: 'Removed',
};

/** Background utility per state category (decorative bars, dots, timeline segments). */
export const STATE_CATEGORY_BG: Record<StateCategory, string> = {
  Proposed: 'bg-col-todo',
  InProgress: 'bg-col-progress',
  Resolved: 'bg-col-resolved',
  Completed: 'bg-col-done',
  Removed: 'bg-col-removed',
};

/** Pill styles (text passes AA on its own background). */
export const STATE_CATEGORY_PILL: Record<StateCategory, string> = {
  Proposed: 'bg-[#fdece6] text-[#9a3412]',
  InProgress: 'bg-[#eef0ff] text-[#3730a3]',
  Resolved: 'bg-[#f3edff] text-[#5b21b6]',
  Completed: 'bg-[#e6f7f4] text-[#115e59]',
  Removed: 'bg-pill text-muted-foreground',
};
