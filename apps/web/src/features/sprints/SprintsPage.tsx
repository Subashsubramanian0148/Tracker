import type { SprintHealth } from '@ado-metrics/shared';
import clsx from 'clsx';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { useSprintHealth } from '../../api/metrics';
import { SectionToolbar } from '../../app/PageHeader';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { Badge } from '../../components/ui/Badge';
import { ChartFigure, LegendItem } from '../../components/ui/ChartFigure';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useRegisterExport } from '../../lib/exportStore';
import { formatNumber, formatPercent, formatShortDate } from '../../lib/format';

const COMMITTED = '#2a78d6';
const COMPLETED = '#1baf7a';
const AXIS = { fontSize: 12, fill: '#6b6b6b' };
const GRID = '#ececec';

function sortSprints(s: SprintHealth[]): SprintHealth[] {
  return [...s].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
}

function SprintTip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as SprintHealth | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground tabular-nums">
        {d.completedCount} of {d.committedCount} done · {formatPercent(d.completionRate)}
      </p>
    </div>
  );
}

export function SprintsPage() {
  const { project, teamId } = useProject();
  const query = useSprintHealth(project.id, teamId);
  const sprints = useMemo(() => sortSprints(query.data ?? []), [query.data]);
  // Charts show sprints that have started; future sprints only appear in the table.
  const charted = sprints.filter((s) => s.timeFrame !== 'future').slice(-12);

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: `${project.name}-sprints.csv`,
            rows: sprints.map((s) => ({
              sprint: s.name,
              path: s.path,
              start: s.startDate ?? '',
              finish: s.finishDate ?? '',
              timeFrame: s.timeFrame,
              committedCount: s.committedCount,
              committedEffort: s.committedEffort,
              completedCount: s.completedCount,
              completedEffort: s.completedEffort,
              addedMidSprint: s.addedMidSprint,
              removedMidSprint: s.removedMidSprint,
              carriedOver: s.carriedOver,
              completionRate: s.completionRate,
            })),
          }
        : null,
    [query.data, sprints, project.name],
  );
  useRegisterExport(exportSource);

  return (
    <div>
      <SectionToolbar title="Sprint health">
        <TeamSelect className="w-44" />
      </SectionToolbar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div role="status" className="space-y-5">
          <span className="sr-only">Loading sprints…</span>
          <div className="grid gap-5 xl:grid-cols-3">
            <Skeleton className="h-80 xl:col-span-2" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : sprints.length === 0 ? (
        <EmptyState
          title="No sprints yet"
          description="Iterations appear here once they’re synced from Azure DevOps."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <ChartFigure
                title="Committed vs completed"
                summary={`Work items committed at sprint start and completed by sprint end, last ${charted.length} sprints.`}
                table={{
                  columns: ['Sprint', 'Committed', 'Completed'],
                  rows: charted.map((s) => [s.name, s.committedCount, s.completedCount]),
                }}
                legend={
                  <div className="mb-2 flex gap-4">
                    <LegendItem color={COMMITTED} label="Committed" shape="bar" />
                    <LegendItem color={COMPLETED} label="Completed" shape="bar" />
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={charted}
                    barGap={2}
                    margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                    accessibilityLayer={false}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={AXIS}
                      tickLine={false}
                      axisLine={{ stroke: GRID }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip content={(p) => <SprintTip {...p} />} cursor={{ fill: '#f3f3f4' }} />
                    <Bar
                      dataKey="committedCount"
                      name="Committed"
                      fill={COMMITTED}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="completedCount"
                      name="Completed"
                      fill={COMPLETED}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </div>
            <div className="min-w-0">
              <ChartFigure
                title="Completion rate"
                summary="Share of committed items finished each sprint."
                table={{
                  columns: ['Sprint', 'Completion rate'],
                  rows: charted.map((s) => [s.name, formatPercent(s.completionRate)]),
                }}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={charted.map((s) => ({
                      ...s,
                      pct: s.completionRate === null ? null : Math.round(s.completionRate * 100),
                    }))}
                    // No negative left margin here: "100%" needs the full axis width.
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                    accessibilityLayer={false}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={AXIS}
                      tickLine={false}
                      axisLine={{ stroke: GRID }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <ReferenceLine y={80} stroke="#9a9a9a" strokeDasharray="3 3" />
                    <Tooltip content={(p) => <SprintTip {...p} />} />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke="#111111"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#111111', strokeWidth: 0 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFigure>
            </div>
          </div>
          <SprintTable sprints={[...sprints].reverse()} />
        </div>
      )}
    </div>
  );
}

function SprintTable({ sprints }: { sprints: SprintHealth[] }) {
  return (
    <Table caption="Sprint health by sprint, newest first">
      <thead>
        <tr>
          <Th>Sprint</Th>
          <Th>Dates</Th>
          <Th className="text-right">Committed</Th>
          <Th className="text-right">Committed pts</Th>
          <Th className="text-right">Completed</Th>
          <Th className="text-right">Completed pts</Th>
          <Th className="text-right">Added mid-sprint</Th>
          <Th className="text-right">Removed mid-sprint</Th>
          <Th className="text-right">Carried over</Th>
          <Th className="text-right">Completion</Th>
        </tr>
      </thead>
      <tbody>
        {sprints.map((s) => {
          const current = s.timeFrame === 'current';
          return (
            <Tr
              key={s.iterationId}
              className={clsx(current && 'bg-brand-soft/40')}
              aria-current={current ? 'true' : undefined}
            >
              <Td className="font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  {s.name}
                  {current ? (
                    <Badge tone="teal">Current</Badge>
                  ) : s.timeFrame === 'future' ? (
                    <Badge>Upcoming</Badge>
                  ) : null}
                </span>
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground tabular-nums">
                {formatShortDate(s.startDate)} – {formatShortDate(s.finishDate)}
              </Td>
              <Num>{s.committedCount}</Num>
              <Num>{s.committedEffort}</Num>
              <Num>{s.completedCount}</Num>
              <Num>{s.completedEffort}</Num>
              <Num>{s.addedMidSprint}</Num>
              <Num>{s.removedMidSprint}</Num>
              <Num warn={s.carriedOver > 0}>{s.carriedOver}</Num>
              <Td className="text-right font-semibold tabular-nums">
                {formatPercent(s.completionRate)}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function Num({ children, warn }: { children: number; warn?: boolean }) {
  return (
    <Td className={clsx('text-right tabular-nums', warn && 'text-warn-strong')}>
      {formatNumber(children, 1)}
    </Td>
  );
}
