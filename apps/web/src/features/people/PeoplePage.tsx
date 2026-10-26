import { endOfDay, startOfDay, subDays } from 'date-fns';
import { ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isApiError } from '../../api/client';
import { usePeopleMetrics } from '../../api/metrics';
import { ForbiddenPage } from '../../app/ErrorPages';
import { SectionToolbar } from '../../app/PageHeader';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { canViewPeople, useMe } from '../../lib/auth';
import { useRegisterExport } from '../../lib/exportStore';
import { formatDays, formatNumber, formatRatio } from '../../lib/format';
import { useNow } from '../../lib/hooks';

type Range = '30' | '90' | '180';

export function PeoplePage() {
  const me = useMe();
  if (!canViewPeople(me.user)) {
    return (
      <ForbiddenPage description="Individual metrics are only available to team leads, managers and admins." />
    );
  }
  return <PeopleContent />;
}

function PeopleContent() {
  const { project, teamId } = useProject();
  const [range, setRange] = useState<Range>('90');
  const now = useNow(60 * 60_000);
  const dayKey = startOfDay(now).getTime();
  const params = useMemo(
    () => ({
      teamId,
      from: startOfDay(subDays(dayKey, Number(range))).toISOString(),
      to: endOfDay(dayKey).toISOString(),
    }),
    [teamId, range, dayKey],
  );
  const query = usePeopleMetrics(project.id, params, true);

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: `${project.name}-people.csv`,
            rows: query.data.map((p) => ({
              person: p.person.displayName,
              completed: p.completedCount,
              active: p.activeCount,
              medianCycleDays: p.cycleTime.median,
              p85CycleDays: p.cycleTime.p85,
              delayed: p.delayedCount,
              estimateRatio: p.estimateAccuracyRatio,
            })),
          }
        : null,
    [query.data, project.name],
  );
  useRegisterExport(exportSource);

  if (query.isError && isApiError(query.error) && query.error.status === 403) {
    return (
      <ForbiddenPage description="The server denied access to individual metrics for this project or team." />
    );
  }

  return (
    <div>
      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-2xl border border-[#fcd9b6] bg-warn-soft px-4 py-3 text-sm text-[#7c2d12]"
      >
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong className="font-semibold">Individual metrics are confidential.</strong> Your
          access is logged. Use these numbers to support people, not to rank them.
        </p>
      </div>
      <SectionToolbar title="People">
        <SegmentedControl<Range>
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
            { value: '180', label: 'Last 180 days' },
          ]}
        />
        <TeamSelect className="w-44" />
      </SectionToolbar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <SkeletonRows rows={6} label="Loading people metrics…" />
      ) : query.data.length === 0 ? (
        <EmptyState
          title="No individual data"
          description="No one has completed or active work in this range."
        />
      ) : (
        <Table caption="Per-person delivery metrics">
          <thead>
            <tr>
              <Th>Person</Th>
              <Th className="text-right">Completed</Th>
              <Th className="text-right">Active</Th>
              <Th className="text-right">Median cycle</Th>
              <Th className="text-right">P85 cycle</Th>
              <Th className="text-right">Delayed</Th>
              <Th className="text-right">Actual / estimate</Th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((p) => (
              <Tr key={p.person.id}>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={p.person.displayName} seed={p.person.id} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium">{p.person.displayName}</span>
                      {p.person.email ? (
                        <span className="block text-xs text-muted-foreground">
                          {p.person.email}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{formatNumber(p.completedCount)}</Td>
                <Td className="text-right tabular-nums">{formatNumber(p.activeCount)}</Td>
                <Td className="text-right tabular-nums">{formatDays(p.cycleTime.median)}</Td>
                <Td className="text-right tabular-nums">{formatDays(p.cycleTime.p85)}</Td>
                <Td className="text-right tabular-nums">{formatNumber(p.delayedCount)}</Td>
                <Td className="text-right tabular-nums">{formatRatio(p.estimateAccuracyRatio)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
