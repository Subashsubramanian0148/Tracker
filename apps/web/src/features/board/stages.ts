import type { WorkItemSummary } from '@ado-metrics/shared';

/** The team's own stages, in order. Reopen is a list of its own, not a step. */
export const STAGES = [
  { key: 'not-started', label: 'Not started', color: 'bg-col-todo' },
  { key: 'wip', label: 'Work in progress', color: 'bg-col-progress' },
  { key: 'review', label: 'Review', color: 'bg-col-resolved' },
  { key: 'handover', label: 'Hand over', color: 'bg-success' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export const REOPEN = { key: 'reopen', label: 'Reopen' } as const;

const REVIEW_HINT = /review|test|qa/i;

/** Which stage a story is at, from its state (and board column for review). */
export function stageOf(item: WorkItemSummary): StageKey | null {
  switch (item.stateCategory) {
    case 'Removed':
      return null;
    case 'Completed':
      return 'handover';
    case 'Proposed':
      return 'not-started';
    case 'Resolved':
      return 'review';
    default:
      return REVIEW_HINT.test(item.state) || REVIEW_HINT.test(item.boardColumn ?? '')
        ? 'review'
        : 'wip';
  }
}

/** Sent back after it was done (state history or a #reopen comment) and not finished again. */
export function isReopened(item: WorkItemSummary): boolean {
  return (
    item.stateCategory !== 'Completed' &&
    item.stateCategory !== 'Removed' &&
    item.delayFlags.some((f) => f === 'REOPENED' || f === 'REOPENED_IN_COMMENTS')
  );
}
