import type { TaskStatus } from '@ado-metrics/shared';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  upcoming: 'Upcoming',
  started: 'Started',
  in_progress: 'In progress',
  approval_pending: 'Approval pending',
  completed: 'Completed',
  reopened: 'Reopened',
};

export const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'amber' | 'success' | 'danger'> =
  {
    upcoming: 'neutral',
    started: 'info',
    in_progress: 'info',
    approval_pending: 'amber',
    completed: 'success',
    reopened: 'danger',
  };

/** Order of the groups on "My tasks": what needs attention first, then the workflow backwards. */
export const OPEN_GROUPS: TaskStatus[] = [
  'reopened',
  'approval_pending',
  'in_progress',
  'started',
  'upcoming',
];

export const STATUS_OPTIONS = (
  ['upcoming', 'started', 'in_progress', 'approval_pending', 'completed', 'reopened'] as const
).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
