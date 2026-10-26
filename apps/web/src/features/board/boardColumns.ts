import type { BoardColumnDef, StateCategory, WorkItemSummary } from '@ado-metrics/shared';

export interface BoardColumnView {
  key: string;
  title: string;
  barClass: string;
  items: WorkItemSummary[];
}

/** Used when the project has no Azure DevOps board layout (e.g. demo data). */
const FALLBACK: { key: StateCategory[]; title: string; barClass: string }[] = [
  { key: ['Proposed'], title: 'To do', barClass: 'bg-col-todo' },
  { key: ['InProgress', 'Resolved'], title: 'In progress', barClass: 'bg-col-progress' },
  { key: ['Completed'], title: 'Done', barClass: 'bg-col-done' },
];

/** Colour of an Azure column, from the states it holds: first = to do, last = done, rest = in progress. */
function barFor(index: number, count: number): string {
  if (index === 0) return 'bg-col-todo';
  if (index === count - 1) return 'bg-col-done';
  return 'bg-col-progress';
}

/**
 * Mirrors the Azure DevOps board: same columns, same order. An item goes in its board column,
 * or, when that is unknown, in the first column mapped to its state. Removed items are hidden.
 */
export function buildColumns(
  items: WorkItemSummary[],
  azure: BoardColumnDef[] | null | undefined,
): BoardColumnView[] {
  const visible = items.filter((i) => i.stateCategory !== 'Removed');
  if (!azure?.length) {
    return FALLBACK.map((c) => ({
      key: c.title,
      title: c.title,
      barClass: c.barClass,
      items: visible.filter((i) => c.key.includes(i.stateCategory)),
    }));
  }
  const columns = azure.map((c, i) => ({
    key: c.name,
    title: c.name,
    barClass: barFor(i, azure.length),
    items: [] as WorkItemSummary[],
  }));
  for (const item of visible) {
    const col =
      columns.find((c) => c.title === item.boardColumn) ??
      columns[azure.findIndex((c) => c.states.includes(item.state))];
    col?.items.push(item);
  }
  return columns;
}
