import type { StateCategory } from '@ado-metrics/shared';
import { STATE_CATEGORIES } from '@ado-metrics/shared';
import type { CategoryResolver } from './engine/history';

/** Fallback for states missing from the synced process metadata (Scrum + Agile defaults). */
const DEFAULTS: Record<string, StateCategory> = {
  new: 'Proposed',
  proposed: 'Proposed',
  approved: 'Proposed',
  'to do': 'Proposed',
  design: 'Proposed',
  committed: 'InProgress',
  active: 'InProgress',
  'in progress': 'InProgress',
  doing: 'InProgress',
  resolved: 'Resolved',
  'in review': 'Resolved',
  done: 'Completed',
  closed: 'Completed',
  completed: 'Completed',
  removed: 'Removed',
  cut: 'Removed',
};

export function toCategory(value: string | null | undefined): StateCategory | null {
  return (STATE_CATEGORIES as readonly string[]).includes(value ?? '')
    ? (value as StateCategory)
    : null;
}

export function buildCategoryResolver(
  rows: readonly { workItemType: string; state: string; category: string }[],
): CategoryResolver {
  const map = new Map<string, StateCategory>();
  for (const r of rows) {
    const c = toCategory(r.category);
    if (c) map.set(`${r.workItemType}\u0000${r.state}`, c);
  }
  return (type, state) =>
    map.get(`${type}\u0000${state}`) ?? DEFAULTS[state.toLowerCase()] ?? 'InProgress';
}
