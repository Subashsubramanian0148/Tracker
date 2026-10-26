import type { CommentSignal, DelayFlag, StateCategory } from '@ado-metrics/shared';
import { DAY_MS, hoursBetween } from './stats';

/** A "done" comment on an item that is still open this long after raises DONE_NOT_CLOSED. */
const DONE_NOT_CLOSED_AFTER_MS = 2 * DAY_MS;

// Negated phrases are removed first so "not done" or "no longer blocked" never count as done/blocked.
const UNBLOCKED = /\b(un-?blocked|no longer (blocked|on hold|waiting)|not blocked|blocker (is )?(resolved|removed|cleared|gone)|back on track|resumed)\b/gi;
const NOT_DONE = /\b(not|isn'?t|wasn'?t|never|nor) (yet )?(done|complete[d]?|finished|approved|delivered|signed[- ]off)\b/gi;
const REOPEN = /\b(re-?open(ed|ing|s)?|sent back|send(ing)? (it )?back|re-?work(ed|ing)?|redo(ing)?|re-?do|rejected|changes requested|not approved)\b/i;
const BLOCKED = /\b(blocked|blocker|blocking|on hold|waiting (on|for)|stuck|held up)\b/i;
const DONE = /\b(complete[d]?|done|finished|delivered|signed[- ]off|approved|handed (off|over))\b/i;

/** Keyword signals in one comment. A comment can carry more than one (e.g. "reopened, waiting on copy"). */
export function commentSignals(text: string): CommentSignal[] {
  const signals: CommentSignal[] = [];
  if (UNBLOCKED.test(text)) signals.push('UNBLOCKED');
  UNBLOCKED.lastIndex = 0;
  const rest = text.replace(UNBLOCKED, ' ').replace(NOT_DONE, ' reopened ');
  if (REOPEN.test(rest)) signals.push('REOPEN');
  if (BLOCKED.test(rest)) signals.push('BLOCKED');
  // "Reopened after it was approved" is a reopen, not a sign-off.
  if (!signals.includes('REOPEN') && !signals.includes('BLOCKED') && DONE.test(rest)) signals.push('DONE');
  return signals;
}

export interface CommentInput {
  createdAt: Date;
  signals: readonly string[];
}

export interface CommentDelay {
  hours: number;
  flags: DelayFlag[];
}

/**
 * Hold-ups described in comments: each REOPEN/BLOCKED comment starts a hold that lasts until a
 * later DONE/UNBLOCKED comment, the item's completion, or now if it is still open.
 */
export function commentDelay(
  comments: readonly CommentInput[],
  item: { stateCategory: StateCategory; completedDate: Date | null },
  now: Date,
): CommentDelay {
  const sorted = [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const done = item.stateCategory === 'Completed';
  const end = done && item.completedDate ? item.completedDate : now;
  const flags = new Set<DelayFlag>();
  let hours = 0;
  let holdFrom: Date | null = null;
  let holdKind: 'REOPEN' | 'BLOCKED' | null = null;
  let lastDone: Date | null = null;

  for (const c of sorted) {
    if (c.createdAt > end) break;
    const s = c.signals;
    if (s.includes('REOPEN')) flags.add('REOPENED_IN_COMMENTS');
    if ((s.includes('DONE') || s.includes('UNBLOCKED')) && holdFrom) {
      hours += hoursBetween(holdFrom, c.createdAt);
      holdFrom = null;
      holdKind = null;
    }
    if (s.includes('DONE')) lastDone = c.createdAt;
    if (s.includes('REOPEN') || s.includes('BLOCKED')) {
      lastDone = null;
      if (!holdFrom) holdFrom = c.createdAt;
      holdKind = s.includes('BLOCKED') ? 'BLOCKED' : (holdKind ?? 'REOPEN');
    }
  }
  if (holdFrom) {
    hours += Math.max(0, hoursBetween(holdFrom, end));
    if (!done && holdKind === 'BLOCKED') flags.add('BLOCKED_IN_COMMENTS');
  }
  if (!done && lastDone && now.getTime() - lastDone.getTime() > DONE_NOT_CLOSED_AFTER_MS) flags.add('DONE_NOT_CLOSED');
  return { hours, flags: [...flags] };
}
