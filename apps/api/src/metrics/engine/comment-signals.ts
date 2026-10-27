import type { CommentSignal, DelayFlag, StateCategory } from '@ado-metrics/shared';
import { hoursBetween } from './stats';

/**
 * Signals come only from explicit tags, so casual wording ("I'm done for today", "not blocked by
 * anything") never counts. Tags: #done, #blocked, #unblocked, #reopen (or #reopened, #sentback).
 */
const TAG = /(?:^|[\s(])#(done|blocked|unblocked|reopen(?:ed)?|sent-?back)\b/gi;

const TAG_SIGNAL: Record<string, CommentSignal> = {
  done: 'DONE',
  blocked: 'BLOCKED',
  unblocked: 'UNBLOCKED',
  reopen: 'REOPEN',
  reopened: 'REOPEN',
  sentback: 'REOPEN',
  'sent-back': 'REOPEN',
};

/** Signals tagged in one comment, in a fixed order. A comment can carry more than one. */
export function commentSignals(text: string): CommentSignal[] {
  const found = new Set<CommentSignal>();
  for (const m of text.matchAll(TAG)) found.add(TAG_SIGNAL[m[1]!.toLowerCase()]!);
  return (['UNBLOCKED', 'REOPEN', 'BLOCKED', 'DONE'] as const).filter((s) => found.has(s));
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

  for (const c of sorted) {
    if (c.createdAt > end) break;
    const s = c.signals;
    if (s.includes('REOPEN')) flags.add('REOPENED_IN_COMMENTS');
    if ((s.includes('DONE') || s.includes('UNBLOCKED')) && holdFrom) {
      hours += hoursBetween(holdFrom, c.createdAt);
      holdFrom = null;
      holdKind = null;
    }
    if (s.includes('REOPEN') || s.includes('BLOCKED')) {
      if (!holdFrom) holdFrom = c.createdAt;
      holdKind = s.includes('BLOCKED') ? 'BLOCKED' : (holdKind ?? 'REOPEN');
    }
  }
  if (holdFrom) {
    hours += Math.max(0, hoursBetween(holdFrom, end));
    if (!done && holdKind === 'BLOCKED') flags.add('BLOCKED_IN_COMMENTS');
  }
  return { hours, flags: [...flags] };
}
