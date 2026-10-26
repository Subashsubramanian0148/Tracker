import type { RevisionSnapshot } from '../src/ado/fields';
import type { RevisionInput } from '../src/metrics/engine/history';
import { buildCategoryResolver } from '../src/metrics/state-categories';

export const scrum = buildCategoryResolver([
  { workItemType: 'Product Backlog Item', state: 'New', category: 'Proposed' },
  { workItemType: 'Product Backlog Item', state: 'Approved', category: 'Proposed' },
  { workItemType: 'Product Backlog Item', state: 'Committed', category: 'InProgress' },
  { workItemType: 'Product Backlog Item', state: 'Done', category: 'Completed' },
  { workItemType: 'Product Backlog Item', state: 'Removed', category: 'Removed' },
]);

export const d = (iso: string) => new Date(iso);

export function snap(overrides: Partial<RevisionSnapshot> = {}): RevisionSnapshot {
  return {
    type: 'Product Backlog Item',
    title: 'Login with Google',
    state: 'New',
    reason: null,
    assignedTo: null,
    iterationPath: null,
    areaPath: 'Proj\\Web',
    createdDate: '2026-03-02T09:00:00.000Z',
    tags: [],
    parentId: null,
    effort: null,
    originalEstimate: null,
    remainingWork: null,
    completedWork: null,
    blocked: false,
    descriptionHash: null,
    acceptanceCriteriaHash: null,
    isDeleted: false,
    ...overrides,
  };
}

/** Builds a revision chain where each step overrides the previous snapshot. */
export function chain(steps: { at: string; by?: string; set: Partial<RevisionSnapshot> }[]): RevisionInput[] {
  let current = snap();
  return steps.map((s, i) => {
    current = { ...current, ...s.set };
    return { rev: i + 1, changedDate: d(s.at), changedById: s.by ?? 'u1', snapshot: current };
  });
}
