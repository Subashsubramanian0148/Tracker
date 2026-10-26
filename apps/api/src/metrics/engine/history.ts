import type { ChangeKind, StateCategory } from '@ado-metrics/shared';
import type { RevisionSnapshot } from '../../ado/fields';
import { hoursBetween } from './stats';

export interface RevisionInput {
  rev: number;
  changedDate: Date;
  changedById: string | null;
  snapshot: RevisionSnapshot;
}

export type CategoryResolver = (workItemType: string, state: string) => StateCategory;

export interface SegmentOut {
  state: string;
  category: StateCategory;
  enteredAt: Date;
  exitedAt: Date | null;
  durationHours: number;
}

export interface IntervalOut {
  iterationPath: string;
  enteredAt: Date;
  exitedAt: Date | null;
}

export interface ChangeOut {
  rev: number;
  changedAt: Date;
  changedById: string | null;
  kind: ChangeKind;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  afterWorkStarted: boolean;
}

export interface HistoryResult {
  segments: SegmentOut[];
  intervals: IntervalOut[];
  changes: ChangeOut[];
  createdDate: Date;
  activatedDate: Date | null;
  completedDate: Date | null;
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  blockedHours: number;
  reopenCount: number;
  initialEffort: number | null;
  initialRemaining: number | null;
}

const STARTED: ReadonlySet<StateCategory> = new Set(['InProgress', 'Resolved']);
const FINISHED: ReadonlySet<StateCategory> = new Set(['Resolved', 'Completed']);
const OPEN: ReadonlySet<StateCategory> = new Set(['Proposed', 'InProgress']);

/**
 * Derives the full timeline of one work item from its revision history.
 *
 * Definitions (documented in docs/METRICS.md):
 * - activated = first time the item entered an InProgress/Resolved state
 * - completed = last time it entered a Completed state, if that is its current category
 * - cycle time = completed - activated; lead time = completed - created
 * - reopen = a transition from Resolved/Completed back to Proposed/InProgress
 */
export function analyzeHistory(
  revisions: readonly RevisionInput[],
  categoryOf: CategoryResolver,
  now: Date,
): HistoryResult {
  if (revisions.length === 0) throw new Error('analyzeHistory requires at least one revision');
  const revs = [...revisions].sort((a, b) => a.rev - b.rev);
  const first = revs[0]!;
  const createdDate = new Date(first.snapshot.createdDate);

  const segments: SegmentOut[] = [];
  const intervals: IntervalOut[] = [];
  const rawChanges: Omit<ChangeOut, 'afterWorkStarted'>[] = [];
  let reopenCount = 0;
  let blockedHours = 0;
  let blockedSince: Date | null = null;
  let initialEffort: number | null = null;
  let initialRemaining: number | null = null;
  let currentPath: string | null = null;

  revs.forEach((r, i) => {
    const s = r.snapshot;
    // The first revision is the creation; it starts at createdDate even if ChangedDate drifts.
    const at = i === 0 ? createdDate : maxDate(r.changedDate, createdDate);
    const category = categoryOf(s.type, s.state);

    const current = segments[segments.length - 1];
    if (!current || current.state !== s.state) {
      if (current) {
        current.exitedAt = at;
        if (FINISHED.has(current.category) && OPEN.has(category)) reopenCount++;
      }
      segments.push({ state: s.state, category, enteredAt: at, exitedAt: null, durationHours: 0 });
    }

    if (i === 0 || s.iterationPath !== currentPath) {
      const open = intervals[intervals.length - 1];
      if (open && open.exitedAt === null) open.exitedAt = at;
      if (s.iterationPath) intervals.push({ iterationPath: s.iterationPath, enteredAt: at, exitedAt: null });
      currentPath = s.iterationPath;
    }

    const isBlocked = s.blocked || s.tags.some((t) => /^blocked\b/i.test(t));
    if (isBlocked && !blockedSince) blockedSince = at;
    if (!isBlocked && blockedSince) {
      blockedHours += Math.max(0, hoursBetween(blockedSince, at));
      blockedSince = null;
    }

    if (initialEffort === null && s.effort !== null) initialEffort = s.effort;
    if (initialRemaining === null && s.remainingWork !== null) initialRemaining = s.remainingWork;

    if (i > 0) rawChanges.push(...diff(revs[i - 1]!, r, at));
  });

  const last = segments[segments.length - 1]!;
  const finalCategory = last.category;
  const end = now;
  for (const seg of segments) {
    seg.durationHours = Math.max(0, hoursBetween(seg.enteredAt, seg.exitedAt ?? end));
  }

  const activatedDate = segments.find((s) => STARTED.has(s.category))?.enteredAt ?? null;
  let completedDate: Date | null = null;
  if (finalCategory === 'Completed') {
    // Walk back over trailing Completed segments (e.g. Done -> Closed) to the first of the run.
    let k = segments.length - 1;
    while (k > 0 && segments[k - 1]!.category === 'Completed') k--;
    completedDate = segments[k]!.enteredAt;
  }

  if (blockedSince) {
    const stop = completedDate ?? now;
    blockedHours += Math.max(0, hoursBetween(blockedSince, stop));
  }

  const cycleTimeHours =
    activatedDate && completedDate && completedDate >= activatedDate
      ? hoursBetween(activatedDate, completedDate)
      : null;
  const leadTimeHours = completedDate ? Math.max(0, hoursBetween(createdDate, completedDate)) : null;

  const changes = rawChanges.map((c) => ({
    ...c,
    afterWorkStarted: activatedDate !== null && c.changedAt > activatedDate,
  }));

  return {
    segments,
    intervals,
    changes,
    createdDate,
    activatedDate,
    completedDate,
    cycleTimeHours,
    leadTimeHours,
    blockedHours,
    reopenCount,
    initialEffort,
    initialRemaining,
  };
}

function diff(prev: RevisionInput, next: RevisionInput, at: Date): Omit<ChangeOut, 'afterWorkStarted'>[] {
  const a = prev.snapshot;
  const b = next.snapshot;
  const out: Omit<ChangeOut, 'afterWorkStarted'>[] = [];
  const push = (kind: ChangeKind, field: string, oldValue: unknown, newValue: unknown) =>
    out.push({
      rev: next.rev,
      changedAt: at,
      changedById: next.changedById,
      kind,
      field,
      oldValue: fmt(oldValue),
      newValue: fmt(newValue),
    });

  if (a.state !== b.state) push('STATE', 'State', a.state, b.state);
  if (a.effort !== b.effort) push('EFFORT', 'Effort', a.effort, b.effort);
  if (a.originalEstimate !== b.originalEstimate) {
    push('EFFORT', 'Original Estimate', a.originalEstimate, b.originalEstimate);
  }
  if (a.title !== b.title) push('REQUIREMENT', 'Title', a.title, b.title);
  // Bodies are compared by hash; adding the first description is not a "change".
  if (a.descriptionHash && a.descriptionHash !== b.descriptionHash) {
    push('REQUIREMENT', 'Description', null, null);
  }
  if (a.acceptanceCriteriaHash && a.acceptanceCriteriaHash !== b.acceptanceCriteriaHash) {
    push('REQUIREMENT', 'Acceptance Criteria', null, null);
  }
  if ((a.assignedTo?.id ?? null) !== (b.assignedTo?.id ?? null)) {
    push('ASSIGNEE', 'Assigned To', a.assignedTo?.displayName, b.assignedTo?.displayName);
  }
  if (a.iterationPath !== b.iterationPath) push('ITERATION', 'Iteration', a.iterationPath, b.iterationPath);
  if (a.blocked !== b.blocked) push('BLOCKED', 'Blocked', a.blocked ? 'Yes' : 'No', b.blocked ? 'Yes' : 'No');
  return out;
}

function fmt(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).slice(0, 500);
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}
