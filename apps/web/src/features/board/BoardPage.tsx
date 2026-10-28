import type { WorkItemSummary } from '@ado-metrics/shared';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useWorkItems, type WorkItemFilters } from '../../api/workItems';
import { SectionToolbar } from '../../app/PageHeader';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SearchInput } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Skeleton';
import { useRegisterExport } from '../../lib/exportStore';
import { BOARD_ONLY } from '../../lib/features';
import { formatNumber } from '../../lib/format';
import { useDebouncedValue, useNow } from '../../lib/hooks';
import { expectedDate, StoryCard } from './StoryCard';
import { isReopened, REOPEN, stageOf, STAGES } from './stages';
import { Select } from '../../components/ui/Select';

type SortKey = 'newest' | 'oldest' | 'due';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'due', label: 'Due soonest' },
];

/** Stories by stage (work in progress by default), one card each. */
export function BoardPage() {
  const { project, teamId } = useProject();
  const location = useLocation();
  const initialSearch = (location.state as { search?: unknown } | null)?.search;
  const [search, setSearch] = useState(typeof initialSearch === 'string' ? initialSearch : '');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const now = useNow();

  const filters: WorkItemFilters = {
    teamId,
    pageSize: 200,
    search: debouncedSearch || undefined,
  };
  const query = useWorkItems(project.id, filters);
  const [stage, setStage] = useState<string>('wip');
  const [sort, setSort] = useState<SortKey>('newest');

  const stages = useMemo(() => {
    const all = query.data?.items ?? [];
    return [
      ...STAGES.map((s) => ({ ...s, items: all.filter((i) => stageOf(i) === s.key) })),
      { ...REOPEN, items: all.filter(isReopened) },
    ].map((s) => {
      // Handed-over stories go by when they were handed over, the rest by when they came in.
      const when = (i: WorkItemSummary) =>
        (s.key === 'handover' ? i.completedDate : null) ?? i.createdDate;
      return {
        ...s,
        items: s.items.sort((a, b) => {
          if (sort === 'oldest') return when(a).localeCompare(when(b));
          // Stories without an expected date go last.
          if (sort === 'due')
            return (expectedDate(a) ?? '9999').localeCompare(expectedDate(b) ?? '9999');
          return when(b).localeCompare(when(a));
        }),
      };
    });
  }, [query.data, sort]);
  const current = stages.find((s) => s.key === stage) ?? stages[0]!;
  const items = current.items;

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: `${project.name}-${current.key}.csv`,
            rows: items.map((i) => ({
              id: i.id,
              type: i.type,
              title: i.title,
              received: i.createdDate,
              assignee: i.assignedTo?.displayName ?? '',
              state: i.state,
              stage: STAGES.find((s) => s.key === stageOf(i))?.label ?? '',
              reopened: isReopened(i),
              expectedBy: expectedDate(i) ?? '',
              delayed: i.isDelayed,
            })),
          }
        : null,
    [query.data, items, project.name, current.key],
  );
  useRegisterExport(exportSource);

  const searchBox = (
    <SearchInput
      label="Search stories"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      maxLength={200}
      className="w-full sm:w-56"
    />
  );
  const stageSelect = (
    <Select
      label="Stage"
      hideLabel
      value={current.key}
      onChange={setStage}
      options={stages.map((s) => ({
        value: s.key,
        label: `${s.label}${query.data ? ` (${formatNumber(s.items.length)})` : ''}`,
      }))}
      triggerClassName="w-full sm:w-60"
    />
  );
  const sortSelect = (
    <Select
      label="Sort"
      hideLabel
      value={sort}
      onChange={(v) => setSort(v as SortKey)}
      options={SORTS}
      triggerClassName="w-full sm:w-44"
    />
  );

  return (
    <div>
      {BOARD_ONLY ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {stageSelect}
          {sortSelect}
          <div className="ml-auto w-full sm:w-auto">{searchBox}</div>
        </div>
      ) : (
        <SectionToolbar title="Stories">
          {stageSelect}
          {sortSelect}
          <TeamSelect className="w-44" />
          {searchBox}
        </SectionToolbar>
      )}

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
          <span className="sr-only">Loading stories…</span>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? 'No stories match' : `Nothing in ${current.label}`}
          description={
            debouncedSearch ? 'Try a different search.' : 'No story is at this stage right now.'
          }
        />
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy={query.isFetching || undefined}
        >
          {items.map((i) => (
            <li key={i.id}>
              <StoryCard item={i} projectId={project.id} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
