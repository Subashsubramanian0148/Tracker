import { applyStatus, buildSummary, isLate, type SummaryRow } from '../src/tasks/task-rules';
import { d } from './fixtures';

const NOW = d('2026-10-23T10:00:00Z');
const blank = { status: 'upcoming' as const, dueDate: null, startedAt: null, completedAt: null };

describe('applyStatus', () => {
  it('stamps the first start and keeps it', () => {
    const started = applyStatus(blank, 'in_progress', NOW);
    expect(started).toEqual({ startedAt: NOW, completedAt: null });
    const later = d('2026-10-24T10:00:00Z');
    expect(
      applyStatus({ ...blank, status: 'approval_pending', startedAt: NOW }, 'in_progress', later)
        .startedAt,
    ).toEqual(NOW);
  });

  it('stamps completion once and clears it on reopen', () => {
    const done = applyStatus(blank, 'completed', NOW);
    expect(done).toEqual({ startedAt: NOW, completedAt: NOW });
    const again = applyStatus(
      { ...blank, status: 'completed', startedAt: NOW, completedAt: NOW },
      'completed',
      d('2026-10-25T00:00:00Z'),
    );
    expect(again.completedAt).toEqual(NOW);
    expect(
      applyStatus(
        { ...blank, status: 'completed', startedAt: NOW, completedAt: NOW },
        'reopened',
        NOW,
      ).completedAt,
    ).toBeNull();
  });
});

describe('isLate', () => {
  const due = d('2026-10-22T00:00:00Z');
  it('counts the whole due day as on time', () => {
    expect(
      isLate({ status: 'in_progress', dueDate: due, completedAt: null }, d('2026-10-22T23:59:00Z')),
    ).toBe(false);
    expect(isLate({ status: 'in_progress', dueDate: due, completedAt: null }, NOW)).toBe(true);
  });
  it('judges finished work by when it finished', () => {
    expect(
      isLate({ status: 'completed', dueDate: due, completedAt: d('2026-10-22T18:00:00Z') }, NOW),
    ).toBe(false);
    expect(
      isLate({ status: 'completed', dueDate: due, completedAt: d('2026-10-23T08:00:00Z') }, NOW),
    ).toBe(true);
  });
  it('is never late without a due date', () => {
    expect(isLate({ status: 'upcoming', dueDate: null, completedAt: null }, NOW)).toBe(false);
  });
});

describe('buildSummary', () => {
  const row = (o: Partial<SummaryRow>): SummaryRow => ({
    ownerId: 'ada',
    ownerName: 'Ada',
    createdAt: d('2026-10-20T09:00:00Z'),
    ...blank,
    ...o,
  });

  it('counts open work, overdue items, completions and the on-time rate', () => {
    const s = buildSummary(
      [
        row({ status: 'in_progress', dueDate: d('2026-10-21T00:00:00Z') }),
        row({ status: 'approval_pending' }),
        row({ ownerId: 'raj', ownerName: 'Raj', status: 'upcoming' }),
        row({
          status: 'completed',
          dueDate: d('2026-10-22T00:00:00Z'),
          completedAt: d('2026-10-22T12:00:00Z'),
        }),
        row({
          status: 'completed',
          dueDate: d('2026-10-20T00:00:00Z'),
          completedAt: d('2026-10-22T12:00:00Z'),
        }),
      ],
      4,
      NOW,
    );
    expect(s.totals).toEqual({
      upcoming: 1,
      started: 0,
      inProgress: 1,
      approvalPending: 1,
      reopened: 0,
      completed: 2,
      overdue: 1,
    });
    expect(s.onTimeRate).toBe(0.5);
    expect(s.people.map((p) => p.owner.displayName)).toEqual(['Ada', 'Raj']);
    expect(s.weekly).toHaveLength(4);
    expect(s.weekly.at(-1)).toEqual({
      weekStart: '2026-10-19',
      created: 5,
      completed: 2,
      completedLate: 1,
    });
  });

  it('ignores completions before the window', () => {
    const s = buildSummary(
      [
        row({
          status: 'completed',
          completedAt: d('2026-01-05T00:00:00Z'),
          createdAt: d('2026-01-01T00:00:00Z'),
        }),
      ],
      4,
      NOW,
    );
    expect(s.totals.completed).toBe(0);
    expect(s.people).toEqual([]);
    expect(s.onTimeRate).toBeNull();
  });
});
