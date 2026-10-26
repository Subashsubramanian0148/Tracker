import { CalendarRange, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useIterations } from '../../api/projects';
import { useWorkItems, type WorkItemFilters } from '../../api/workItems';
import { SectionToolbar } from '../../app/PageHeader';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { buttonClasses } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SearchInput } from '../../components/ui/Field';
import { Popover } from '../../components/ui/Popover';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { useRegisterExport } from '../../lib/exportStore';
import { BOARD_ONLY } from '../../lib/features';
import { formatNumber } from '../../lib/format';
import { useDebouncedValue, useNow } from '../../lib/hooks';
import { BoardColumn } from './BoardColumn';
import { buildColumns } from './boardColumns';

type Segment = 'all' | 'sprint' | 'delayed' | 'backlog';
type SortKey = NonNullable<WorkItemFilters['sort']>;

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'Product Backlog Item', label: 'Product Backlog Item' },
  { value: 'Issue', label: 'Issue' },
  { value: 'Bug', label: 'Bug' },
  { value: 'Task', label: 'Task' },
  { value: 'Feature', label: 'Feature' },
  { value: 'Epic', label: 'Epic' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'changedDate', label: 'Recently changed' },
  { value: 'cycleTime', label: 'Cycle time' },
  { value: 'leadTime', label: 'Lead time' },
  { value: 'id', label: 'ID' },
];

export function BoardPage() {
  const { project, teamId, summary } = useProject();
  const location = useLocation();
  const initialSearch = (location.state as { search?: unknown } | null)?.search;
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState(typeof initialSearch === 'string' ? initialSearch : '');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<SortKey | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const now = useNow();

  const iterations = useIterations(project.id, teamId, segment === 'sprint');
  const currentIteration = iterations.data?.find((i) => i.timeFrame === 'current');
  const waitingForSprint = segment === 'sprint' && !currentIteration;

  const filters: WorkItemFilters = {
    teamId,
    pageSize: 200,
    search: debouncedSearch || undefined,
    type: type || undefined,
    sort,
    iterationPath: segment === 'sprint' ? currentIteration?.path : undefined,
    delayed: segment === 'delayed' ? true : undefined,
    stateCategory: segment === 'backlog' ? 'Proposed' : undefined,
  };
  const query = useWorkItems(project.id, filters, !waitingForSprint);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const columns = useMemo(
    () => buildColumns(items, summary?.boardColumns),
    [items, summary?.boardColumns],
  );

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: `${project.name}-board.csv`,
            rows: items.map((i) => ({
              id: i.id,
              type: i.type,
              title: i.title,
              state: i.state,
              assignee: i.assignedTo?.displayName ?? '',
              iteration: i.iterationPath ?? '',
              effort: i.effort,
              cycleTimeDays: i.cycleTimeDays,
              leadTimeDays: i.leadTimeDays,
              dueDate: i.dueDate ?? '',
              delayed: i.isDelayed,
              delayFlags: i.delayFlags.join(' '),
              hasDelayReason: i.hasDelayReason,
            })),
          }
        : null,
    [query.data, items, project.name],
  );
  useRegisterExport(exportSource);

  const loading = query.isPending && !waitingForSprint;
  const sprintMissing = segment === 'sprint' && iterations.isSuccess && !currentIteration;

  const segments = (
    <SegmentedControl<Segment>
      label="Board filter"
      value={segment}
      onChange={setSegment}
      options={[
        { value: 'all', label: 'All items' },
        { value: 'sprint', label: 'Current sprint' },
        { value: 'delayed', label: 'Delayed' },
        { value: 'backlog', label: 'Backlog' },
      ]}
    />
  );
  const searchBox = (
    <SearchInput
      label="Search work items"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      maxLength={200}
      className="w-full sm:w-56"
    />
  );

  return (
    <div>
      {BOARD_ONLY ? (
        // One team, one board: just the view switch and search.
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {segments}
          <div className="ml-auto w-full sm:w-auto">{searchBox}</div>
        </div>
      ) : (
      <SectionToolbar
        title="Your work items"
        right={
          <Popover
            align="end"
            label="Quick filters"
            panelClassName="w-72 p-4"
            trigger={(props) => (
              <button type="button" {...props} className={buttonClasses('secondary', 'md')}>
                <SlidersHorizontal aria-hidden className="size-4" />
                Quick Filters
                {type || sort ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                    <span className="sr-only">(active)</span>
                  </>
                ) : null}
              </button>
            )}
          >
            {() => (
              <div className="space-y-3">
                <Select
                  label="Work item type"
                  value={type}
                  onChange={setType}
                  options={TYPE_OPTIONS}
                />
                <Select
                  label="Sort by"
                  value={sort ?? 'changedDate'}
                  onChange={(v) => setSort(v === 'changedDate' ? undefined : (v as SortKey))}
                  options={SORT_OPTIONS}
                />
                {type || sort ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setType('');
                      setSort(undefined);
                    }}
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            )}
          </Popover>
        }
      >
        {segments}
        <TeamSelect className="w-44" />
        {searchBox}
      </SectionToolbar>
      )}

      {segment === 'sprint' && currentIteration ? (
        <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarRange aria-hidden className="size-4" />
          {currentIteration.name}
        </p>
      ) : null}

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : iterations.isError && segment === 'sprint' ? (
        <ErrorState error={iterations.error} onRetry={() => void iterations.refetch()} />
      ) : sprintMissing ? (
        <EmptyState
          title="No current sprint"
          description="This team has no iteration covering today. Pick another team or view all items."
        />
      ) : !loading && items.length === 0 ? (
        <EmptyState
          title="No work items match"
          description={
            debouncedSearch || type
              ? 'Try a different search or clear the quick filters.'
              : 'Nothing has been synced for this view yet.'
          }
        />
      ) : (
        <>
          <div
            className="relative -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 lg:grid lg:snap-none lg:overflow-visible"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            aria-busy={query.isFetching || undefined}
          >
            {columns.map((c) => (
              <BoardColumn
                key={c.key}
                title={c.title}
                barClass={c.barClass}
                items={c.items}
                projectId={project.id}
                now={now}
                loading={loading || (segment === 'sprint' && iterations.isPending)}
              />
            ))}
          </div>
          {query.data && query.data.total > query.data.items.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing {formatNumber(query.data.items.length)} of {formatNumber(query.data.total)}{' '}
              items. Narrow the filters to see the rest.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
