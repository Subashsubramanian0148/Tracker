import { analyzeHistory } from '../src/metrics/engine/history';
import { carriedOverCount, detectDelays, type SprintWindow } from '../src/metrics/engine/delays';
import { computeSprintHealth } from '../src/metrics/engine/sprint-health';
import { distribution, percentile, weekStartUtc } from '../src/metrics/engine/stats';
import { chain, d, scrum } from './fixtures';

const NOW = d('2026-04-30T00:00:00Z');

describe('stats', () => {
  it('computes inclusive percentiles with interpolation', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.85)).toBe(10);
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.85)).toBeCloseTo(8.65);
  });

  it('summarises a distribution and ignores non-finite values', () => {
    expect(distribution([4, 2, Number.NaN, 6])).toEqual({ count: 3, avg: 4, median: 4, p85: 5.4, max: 6 });
    expect(distribution([])).toEqual({ count: 0, avg: null, median: null, p85: null, max: null });
  });

  it('buckets dates into ISO weeks starting Monday UTC', () => {
    expect(weekStartUtc(d('2026-03-08T23:00:00Z')).toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(weekStartUtc(d('2026-03-09T00:00:00Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });
});

describe('analyzeHistory', () => {
  const simple = chain([
    { at: '2026-03-02T09:00:00Z', set: { state: 'New', effort: 3 } },
    { at: '2026-03-03T09:00:00Z', set: { state: 'Approved' } },
    { at: '2026-03-05T09:00:00Z', set: { state: 'Committed', iterationPath: 'Proj\\Sprint 1' } },
    { at: '2026-03-06T09:00:00Z', set: { effort: 5 } },
    { at: '2026-03-10T09:00:00Z', set: { state: 'Done' } },
  ]);

  it('derives activation, completion, cycle and lead time', () => {
    const h = analyzeHistory(simple, scrum, NOW);
    expect(h.activatedDate).toEqual(d('2026-03-05T09:00:00Z'));
    expect(h.completedDate).toEqual(d('2026-03-10T09:00:00Z'));
    expect(h.cycleTimeHours).toBe(5 * 24);
    expect(h.leadTimeHours).toBe(8 * 24);
    expect(h.reopenCount).toBe(0);
    expect(h.initialEffort).toBe(3);
  });

  it('builds contiguous state segments', () => {
    const h = analyzeHistory(simple, scrum, NOW);
    expect(h.segments.map((s) => [s.state, s.durationHours])).toEqual([
      ['New', 24],
      ['Approved', 48],
      ['Committed', 120],
      ['Done', expect.any(Number)],
    ]);
    expect(h.segments[3]!.exitedAt).toBeNull();
  });

  it('flags effort changes after work started as scope changes', () => {
    const h = analyzeHistory(simple, scrum, NOW);
    const effort = h.changes.find((c) => c.kind === 'EFFORT');
    expect(effort).toMatchObject({ oldValue: '3', newValue: '5', afterWorkStarted: true });
    const stateChange = h.changes.find((c) => c.kind === 'STATE' && c.newValue === 'Approved');
    expect(stateChange?.afterWorkStarted).toBe(false);
  });

  it('counts reopens and uses the final completion for cycle time', () => {
    const h = analyzeHistory(
      chain([
        { at: '2026-03-02T00:00:00Z', set: { state: 'New' } },
        { at: '2026-03-03T00:00:00Z', set: { state: 'Committed' } },
        { at: '2026-03-04T00:00:00Z', set: { state: 'Done' } },
        { at: '2026-03-06T00:00:00Z', set: { state: 'Committed' } },
        { at: '2026-03-09T00:00:00Z', set: { state: 'Done' } },
      ]),
      scrum,
      NOW,
    );
    expect(h.reopenCount).toBe(1);
    expect(h.completedDate).toEqual(d('2026-03-09T00:00:00Z'));
    expect(h.cycleTimeHours).toBe(6 * 24); // first activation → final completion
  });

  it('has no completion or cycle time while still in progress', () => {
    const h = analyzeHistory(simple.slice(0, 3), scrum, NOW);
    expect(h.completedDate).toBeNull();
    expect(h.cycleTimeHours).toBeNull();
    expect(h.leadTimeHours).toBeNull();
  });

  it('accumulates blocked time from the Blocked field and "blocked" tags', () => {
    const h = analyzeHistory(
      chain([
        { at: '2026-03-02T00:00:00Z', set: { state: 'Committed' } },
        { at: '2026-03-03T00:00:00Z', set: { blocked: true } },
        { at: '2026-03-04T00:00:00Z', set: { blocked: false } },
        { at: '2026-03-05T00:00:00Z', set: { tags: ['Blocked-by-API'] } },
        { at: '2026-03-05T12:00:00Z', set: { tags: [] } },
      ]),
      scrum,
      NOW,
    );
    expect(h.blockedHours).toBe(36);
  });

  it('tracks iteration intervals and records sprint moves', () => {
    const h = analyzeHistory(
      chain([
        { at: '2026-03-02T09:00:00Z', set: { iterationPath: 'Proj\\Sprint 1' } },
        { at: '2026-03-03T00:00:00Z', set: { state: 'Committed' } },
        { at: '2026-03-14T00:00:00Z', set: { iterationPath: 'Proj\\Sprint 2' } },
      ]),
      scrum,
      NOW,
    );
    expect(h.intervals).toEqual([
      { iterationPath: 'Proj\\Sprint 1', enteredAt: d('2026-03-02T09:00:00Z'), exitedAt: d('2026-03-14T00:00:00Z') },
      { iterationPath: 'Proj\\Sprint 2', enteredAt: d('2026-03-14T00:00:00Z'), exitedAt: null },
    ]);
    expect(h.changes.filter((c) => c.kind === 'ITERATION')).toHaveLength(1);
  });

  it('treats the first description as content, later edits as requirement changes', () => {
    const h = analyzeHistory(
      chain([
        { at: '2026-03-02T00:00:00Z', set: {} },
        { at: '2026-03-02T01:00:00Z', set: { descriptionHash: 'a' } },
        { at: '2026-03-03T00:00:00Z', set: { state: 'Committed' } },
        { at: '2026-03-04T00:00:00Z', set: { descriptionHash: 'b' } },
      ]),
      scrum,
      NOW,
    );
    const edits = h.changes.filter((c) => c.kind === 'REQUIREMENT');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ field: 'Description', afterWorkStarted: true, oldValue: null, newValue: null });
  });
});

describe('delay detection', () => {
  const sprint1: SprintWindow = { path: 'Proj\\Sprint 1', startDate: d('2026-03-02T00:00:00Z'), finishDate: d('2026-03-13T00:00:00Z') };
  const sprint2: SprintWindow = { path: 'Proj\\Sprint 2', startDate: d('2026-03-16T00:00:00Z'), finishDate: d('2026-03-27T00:00:00Z') };
  const ctx = {
    now: NOW,
    p85CycleHoursByType: new Map([['Product Backlog Item', 7 * 24]]),
    sprintsByPath: new Map([
      [sprint1.path, sprint1],
      [sprint2.path, sprint2],
    ]),
    blockedThresholdHours: 48,
  };
  const base = {
    type: 'Product Backlog Item',
    stateCategory: 'InProgress' as const,
    iterationPath: sprint2.path,
    activatedDate: d('2026-03-03T00:00:00Z'),
    completedDate: null,
    cycleTimeHours: null,
    blockedHours: 0,
    reopenCount: 0,
    intervals: [
      { iterationPath: sprint1.path, enteredAt: d('2026-03-02T00:00:00Z'), exitedAt: d('2026-03-16T00:00:00Z') },
      { iterationPath: sprint2.path, enteredAt: d('2026-03-16T00:00:00Z'), exitedAt: null },
    ],
  };

  it('raises every applicable flag for a long-running carried-over item', () => {
    expect(detectDelays({ ...base, blockedHours: 60, reopenCount: 1 }, ctx)).toEqual([
      'CYCLE_TIME_OUTLIER',
      'CARRIED_OVER',
      'PAST_SPRINT_END',
      'LONG_BLOCKED',
      'REOPENED',
    ]);
  });

  it('counts each sprint an item was carried out of', () => {
    expect(carriedOverCount(base, ctx)).toBe(2);
  });

  it('does not flag an item completed within its sprint and the baseline', () => {
    const flags = detectDelays(
      {
        ...base,
        stateCategory: 'Completed',
        iterationPath: sprint1.path,
        completedDate: d('2026-03-09T00:00:00Z'),
        cycleTimeHours: 6 * 24,
        intervals: [{ iterationPath: sprint1.path, enteredAt: d('2026-03-02T00:00:00Z'), exitedAt: null }],
      },
      ctx,
    );
    expect(flags).toEqual([]);
  });

  it('does not count the current sprint as carried over before its finish day is over', () => {
    const current = { ...base, intervals: [{ iterationPath: sprint2.path, enteredAt: d('2026-03-16T00:00:00Z'), exitedAt: null }] };
    // The day before the finish date, and during the finish date itself.
    expect(carriedOverCount(current, { ...ctx, now: d('2026-03-26T12:00:00Z') })).toBe(0);
    expect(carriedOverCount(current, { ...ctx, now: d('2026-03-27T18:00:00Z') })).toBe(0);
    expect(carriedOverCount(current, { ...ctx, now: d('2026-03-28T01:00:00Z') })).toBe(1);
  });

  it('ignores epics and features', () => {
    expect(detectDelays({ ...base, type: 'Feature', blockedHours: 999 }, ctx)).toEqual([]);
  });
});

describe('sprint health', () => {
  const sprint: SprintWindow = { path: 'P\\S1', startDate: d('2026-03-02T00:00:00Z'), finishDate: d('2026-03-13T00:00:00Z') };
  const iv = (enteredAt: string, exitedAt: string | null) => ({
    iterationPath: 'P\\S1',
    enteredAt: d(enteredAt),
    exitedAt: exitedAt ? d(exitedAt) : null,
  });

  it('separates committed, added, removed, completed and carried-over work', () => {
    const r = computeSprintHealth(
      sprint,
      [
        { id: 1, effort: 3, completedDate: d('2026-03-10T00:00:00Z'), intervals: [iv('2026-02-27T00:00:00Z', null)] },
        { id: 2, effort: 5, completedDate: null, intervals: [iv('2026-03-01T00:00:00Z', '2026-03-16T00:00:00Z')] },
        { id: 3, effort: 2, completedDate: d('2026-03-12T00:00:00Z'), intervals: [iv('2026-03-06T00:00:00Z', null)] },
        { id: 4, effort: 8, completedDate: null, intervals: [iv('2026-03-01T00:00:00Z', '2026-03-05T00:00:00Z')] },
        { id: 5, effort: 1, completedDate: null, intervals: [iv('2026-03-20T00:00:00Z', null)] },
      ],
      NOW,
    );
    expect(r).toEqual({
      committedCount: 3,
      committedEffort: 16,
      completedCount: 2,
      completedEffort: 5,
      addedMidSprint: 1,
      removedMidSprint: 1,
      carriedOver: 1,
      completionRate: 1 / 3,
    });
  });
});
