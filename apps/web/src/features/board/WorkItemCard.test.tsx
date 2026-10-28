import type { WorkItemSummary } from '@ado-metrics/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { WorkItemCard } from './WorkItemCard';

function item(overrides: Partial<WorkItemSummary> = {}): WorkItemSummary {
  return {
    id: 1234,
    projectId: 'p1',
    type: 'Product Backlog Item',
    title: 'Checkout supports saved cards',
    state: 'Committed',
    stateCategory: 'InProgress',
    boardColumn: null,
    assignedTo: { id: 'u1', displayName: 'Priya Raman' },
    iterationPath: 'Scaler\\Sprint 12',
    iterationFromParent: false,
    areaPath: null,
    effort: 5,
    tags: [],
    parentId: null,
    createdDate: '2026-05-01T09:00:00Z',
    changedDate: '2026-05-10T09:00:00Z',
    activatedDate: '2026-05-06T09:00:00Z',
    completedDate: null,
    dueDate: '2026-05-16T00:00:00Z',
    cycleTimeDays: null,
    leadTimeDays: null,
    isDelayed: false,
    delayFlags: [],
    hasDelayReason: false,
    ...overrides,
  };
}

function renderCard(wi: WorkItemSummary, now: number) {
  return render(
    <MemoryRouter>
      <WorkItemCard item={wi} projectId="p1" now={now} />
    </MemoryRouter>,
  );
}

describe('WorkItemCard', () => {
  it('renders id chip, title, due date, assignee and points as a link', () => {
    renderCard(item(), Date.parse('2026-05-10T12:00:00Z'));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/projects/p1/work-items/1234');
    expect(screen.getByText('PBI · 1234')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Checkout supports saved cards' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Sprint ends 1[56] May$/)).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('5 pts')).toBeInTheDocument();
    expect(screen.getByText(/Active 4d/)).toBeInTheDocument();
    expect(screen.queryByText('Delayed')).not.toBeInTheDocument();
  });

  it('shows the delay flag, reason badge and overdue date', () => {
    renderCard(
      item({
        isDelayed: true,
        delayFlags: ['PAST_SPRINT_END', 'LONG_BLOCKED'],
        hasDelayReason: true,
      }),
      Date.parse('2026-05-20T12:00:00Z'),
    );
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText(/Past sprint end, Blocked a long time/)).toBeInTheDocument();
    expect(screen.getByText('Reason added')).toBeInTheDocument();
    expect(screen.getByText(/^Overdue 1[56] May$/)).toBeInTheDocument();
  });

  it('shows working time for done items and never marks them overdue', () => {
    renderCard(
      item({
        stateCategory: 'Completed',
        state: 'Done',
        cycleTimeDays: 6.2,
        leadTimeDays: 11,
        completedDate: '2026-05-12T00:00:00Z',
      }),
      Date.parse('2026-06-20T12:00:00Z'),
    );
    expect(screen.getByText(/Worked 6 days · 11 days from request/)).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });
});
