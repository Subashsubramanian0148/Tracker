import clsx from 'clsx';
import type { OverviewMetrics, StorySummary } from '@ado-metrics/shared';
import { endOfDay, format, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { Layers, Shuffle, Target, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOverviewMetrics, useStorySummary } from '../../api/metrics';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { BarList } from '../../components/ui/BarList';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Avatar } from '../../components/ui/Avatar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { useRegisterExport } from '../../lib/exportStore';
import { BOARD_ONLY } from '../../lib/features';
import { formatNumber, formatPercent, formatRatio } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { delayFlagLabel } from '../../lib/labels';
import { readPref, writePref } from '../../lib/prefs';
import { Hint } from '../../components/ui/Tooltip';
import { StoryDetailSheet, type DetailKind } from './StoryDetailSheet';

// Plain-English names used on this page only; other pages keep the Azure DevOps terms.
const WARNING_LABELS: Record<string, string> = {
  CYCLE_TIME_OUTLIER: 'Took Longer than Typical',
  CARRIED_OVER: 'Carried Over to Next Sprint',
  PAST_SPRINT_END: 'Missed Sprint Deadline',
  LONG_BLOCKED: 'Stuck / Blocked Too Long',
  REOPENED: 'Sent Back / Reopened',
  REOPENED_IN_COMMENTS: 'Reopened in Comments',
  BLOCKED_IN_COMMENTS: 'Blocked in Comments',
  DONE_NOT_CLOSED: 'Done in Comments, Not Closed',
};

/** 1.22 → "+22% Over", 0.85 → "-15% Under", 1 → "On Target". */
export function formatOverUnder(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  const pct = Math.round((ratio - 1) * 100);
  if (pct === 0) return 'On Target';
  return pct > 0 ? `+${pct}% Over` : `${pct}% Under`;
}
/** When the team started tracking its work here; the "Since May 2026" period starts on this day. */
const TRACKING_START = new Date(2026, 4, 1);

type Period = 'week' | 'month' | 'year' | 'tracking';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'tracking', label: 'Since May 2026' },
];

function usePeriod(): [Period, (p: Period) => void] {
  const [period, setPeriod] = useState<Period>(() => {
    const saved = readPref('overview.period');
    return PERIODS.some((p) => p.value === saved) ? (saved as Period) : 'month';
  });
  return [
    period,
    (p) => {
      setPeriod(p);
      writePref('overview.period', p);
    },
  ];
}

function periodStart(period: Period, day: number): Date {
  if (period === 'week') return startOfWeek(day, { weekStartsOn: 1 });
  if (period === 'month') return startOfMonth(day);
  if (period === 'tracking') return TRACKING_START;
  return startOfYear(day);
}

export function OverviewPage() {
  const { project, teamId } = useProject();
  const [period, setPeriod] = usePeriod();
  const now = useNow(60 * 60_000);
  const dayKey = startOfDay(now).getTime();

  // Day-aligned bounds keep the query key stable for the whole day.
  const params = useMemo(
    () => ({
      teamId,
      from: periodStart(period, dayKey).toISOString(),
      to: endOfDay(dayKey).toISOString(),
    }),
    [teamId, period, dayKey],
  );
  const metrics = useOverviewMetrics(project.id, params);
  const stories = useStorySummary(project.id, params);
  const [detail, setDetail] = useState<{ kind: DetailKind; group?: string } | null>(null);
  const open = (kind: DetailKind) => () => setDetail({ kind });

  const exportSource = useMemo(
    () =>
      stories.data
        ? {
            filename: `${project.name}-stories-by-person.csv`,
            rows: stories.data.people.map((p) => ({
              person: p.person?.displayName ?? 'Unassigned',
              stories: p.total,
              open: p.open,
              delivered: p.delivered,
            })),
          }
        : null,
    [stories.data, project.name],
  );
  useRegisterExport(exportSource);

  const error = metrics.error ?? stories.error;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedControl<Period>
          label="Period"
          value={period}
          onChange={setPeriod}
          options={PERIODS}
        />
        <p className="text-sm text-muted-foreground tabular-nums">
          {format(new Date(params.from), 'dd/MM/yyyy')} – {format(dayKey, 'dd/MM/yyyy')}
        </p>
        {BOARD_ONLY ? null : <TeamSelect className="ml-auto w-44" />}
      </div>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void metrics.refetch();
            void stories.refetch();
          }}
        />
      ) : (
        <div
          className="space-y-4 [&>h2:not(:first-child)]:pt-4"
          aria-busy={metrics.isFetching || stories.isFetching || undefined}
        >
          <SectionLabel>Delivery</SectionLabel>
          <div className="grid gap-5 lg:grid-cols-3">
            <StoriesSummaryCard
              data={stories.data}
              onOpen={(kind, group) => setDetail({ kind, group })}
            />
            <PeopleCard data={stories.data} onOpen={open('people')} />
          </div>
          <SectionLabel>Flow &amp; predictability</SectionLabel>
          {metrics.data ? (
            <Body metrics={metrics.data} onOpenWarnings={open('warnings')} />
          ) : (
            <BodySkeleton />
          )}
          <StoryDetailSheet
            view={detail}
            data={stories.data}
            projectId={project.id}
            onClose={() => setDetail(null)}
          />
        </div>
      )}
    </div>
  );
}

/** Small heading that groups a row of cards. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

/** Overview cards: hairline border, no shadow, filling the row's height. */
const CARD = 'flex h-full flex-col border-line shadow-none';

interface Segment {
  label: string;
  value: number;
  dotClass: string;
}

/** Card header in the plan-usage style: dark icon tile, title and subtitle, details button. */
function PlanHeader({
  icon: Icon,
  title,
  description,
  onOpen,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-6 pt-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-sidebar text-ink-soft">
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:border-line-strong hover:text-ink"
        >
          View details
          <span className="sr-only">: {title}</span>
        </button>
      ) : null}
    </div>
  );
}

interface Stat {
  label: string;
  value: React.ReactNode;
}

/** Row of headline numbers across the card foot, split by hairlines. */
function StatStrip({ stats, cols }: { stats: Stat[]; cols: 2 | 3 | 4 }) {
  return (
    <dl
      className={clsx(
        'mt-auto grid border-t border-line',
        cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {stats.map((st, i) => (
        <div
          key={st.label}
          className={clsx(
            'border-line px-6 py-4',
            i % cols !== 0 && 'border-l',
            i >= cols && 'border-t',
          )}
        >
          <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            {st.label}
          </dt>
          <dd className="mt-1.5 font-number text-[28px] leading-none tabular-nums">{st.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Overview card: plan-style header, optional body, optional strip of numbers. */
function PlanCard({
  icon,
  title,
  description,
  onOpen,
  children,
  stats,
  cols = 3,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  onOpen?: () => void;
  children?: React.ReactNode;
  stats?: Stat[];
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <Card className={clsx(CARD, 'gap-0 overflow-hidden rounded-2xl p-0!', className)}>
      <PlanHeader icon={icon} title={title} description={description} onOpen={onOpen} />
      {children ? <div className="flex flex-1 flex-col px-6 pt-5 pb-6">{children}</div> : null}
      {stats ? (
        <div className={clsx('mt-auto', !children && 'pt-5')}>
          <StatStrip stats={stats} cols={cols} />
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Stories at a glance, laid out like a plan-usage panel: header, one stacked bar by stage with
 * its legend, then a strip of headline numbers. Every number opens its slice in the detail sheet.
 */
function StoriesSummaryCard({
  data,
  onOpen,
}: {
  data: StorySummary | undefined;
  onOpen: (kind: DetailKind, group?: string) => void;
}) {
  const total = data?.total ?? 0;
  const parts: (Segment & { group: string })[] = data
    ? [
        { label: 'Yet to start', value: data.yetToStart, dotClass: 'bg-col-todo', group: 'todo' },
        {
          label: 'In progress',
          value: data.inProgress,
          dotClass: 'bg-col-progress',
          group: 'progress',
        },
        { label: 'Delivered', value: data.delivered, dotClass: 'bg-col-done', group: 'done' },
      ]
    : [];
  const stats: { label: string; value: string; kind: DetailKind; group?: string }[] = data
    ? [
        { label: 'Total stories', value: formatNumber(total), kind: 'stages' },
        { label: 'Delivered', value: formatNumber(data.delivered), kind: 'stages', group: 'done' },
        {
          label: 'On time',
          value: total ? formatPercent(data.onTime / total) : '—',
          kind: 'delay',
          group: 'ontime',
        },
        { label: 'Delayed', value: formatNumber(data.delayed), kind: 'delay', group: 'delayed' },
      ]
    : [];

  return (
    <Card className={clsx(CARD, 'gap-0 overflow-hidden rounded-2xl p-0! lg:col-span-2')}>
      <PlanHeader
        icon={Layers}
        title="Stories"
        description="On the board in this period"
        onOpen={() => onOpen('stages')}
      />

      {data ? (
        <>
          <div className="px-6 pt-5 pb-5">
            <div
              className="flex h-3.5 gap-1"
              role="img"
              aria-label={`Stories by stage: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}
            >
              {total > 0 ? (
                parts
                  .filter((p) => p.value > 0)
                  .map((p) => (
                    <div
                      key={p.label}
                      className={clsx('rounded-[4px]', p.dotClass)}
                      style={{ width: `${(p.value / total) * 100}%` }}
                    />
                  ))
              ) : (
                <div className="w-full rounded-[4px] bg-sidebar" />
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
              {parts.map((p) => (
                <li key={p.label}>
                  <button
                    type="button"
                    onClick={() => onOpen('stages', p.group)}
                    className="inline-flex items-center gap-1.5 hover:text-ink"
                  >
                    <span aria-hidden className={clsx('size-2 rounded-full', p.dotClass)} />
                    {p.label}
                    <span className="font-medium text-ink tabular-nums">
                      {formatNumber(p.value)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto grid grid-cols-2 border-t border-line pt-0 sm:grid-cols-4 [&>*]:border-line">
            {stats.map((st, i) => (
              <button
                key={st.label}
                type="button"
                onClick={() => onOpen(st.kind, st.group)}
                className={clsx(
                  'px-6 py-4 text-left transition-colors hover:bg-sidebar',
                  i > 0 && 'sm:border-l',
                  i % 2 === 1 && 'border-l',
                  i > 1 && 'border-t sm:border-t-0',
                )}
              >
                <span className="block text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {st.label}
                </span>
                <span className="mt-1.5 block font-number text-[28px] leading-none tabular-nums">
                  {st.value}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <Skeleton className="m-6 h-32" />
      )}
    </Card>
  );
}

function PeopleCard({ data, onOpen }: { data: StorySummary | undefined; onOpen: () => void }) {
  // Who holds the most open work first.
  const assigned = (data?.people.filter((p) => p.person) ?? []).sort((x, y) => y.open - x.open);
  const unassigned = data?.people.find((p) => !p.person)?.open ?? 0;
  return (
    <PlanCard onOpen={onOpen} title="Teammates" description="Open stories per person" icon={Users}>
      {!data ? (
        <Skeleton className="h-32" />
      ) : assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assigned stories in this period.</p>
      ) : (
        // One line per person so this card matches the height of its neighbours.
        <ul className="-mr-2 max-h-[132px] divide-y divide-line overflow-y-auto pr-2">
          {assigned.map(({ person, open }) => (
            <li key={person!.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <Avatar name={person!.displayName} seed={person!.id} size="xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {person!.displayName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {open > 0 ? (
                  <>
                    Holding{' '}
                    <span className="font-semibold text-ink tabular-nums">
                      {formatNumber(open)}
                    </span>{' '}
                    {open === 1 ? 'story' : 'stories'}
                  </>
                ) : (
                  'No stories'
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && unassigned > 0 ? (
        <p className="mt-auto pt-3 text-xs text-muted-foreground">
          {formatNumber(unassigned)} open {unassigned === 1 ? 'story is' : 'stories are'} not
          assigned yet
        </p>
      ) : null}
    </PlanCard>
  );
}

function Body({
  metrics,
  onOpenWarnings,
}: {
  metrics: OverviewMetrics;
  onOpenWarnings: () => void;
}) {
  const sc = metrics.scopeChanges;
  const ea = metrics.estimateAccuracy;
  const flags = metrics.delays.byFlag.filter((f) => f.count > 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <PlanCard
        className="lg:col-span-2"
        title="Mid-Sprint Changes & Revisions"
        description={
          sc.itemsAffected === 0
            ? 'No stories changed after work started'
            : `${formatNumber(sc.itemsAffected)} ${sc.itemsAffected === 1 ? 'story' : 'stories'} changed or added after work started`
        }
        icon={Shuffle}
        stats={[
          ['Estimate changes', sc.effortChanges],
          ['Requirement updates', sc.requirementEdits],
          ['Moved to next sprint', sc.sprintMoves],
          ['Owner changed', sc.reassignments],
          ['Added mid-sprint', sc.addedMidSprint],
          ['Stories affected', sc.itemsAffected],
        ].map(([label, value]) => ({
          label: String(label),
          value: formatNumber(Number(value)),
        }))}
      />
      <PlanCard
        title="Estimate vs. Actual Time"
        description={
          ea.itemsWithEstimates
            ? `${formatNumber(ea.itemsWithEstimates)} of ${formatNumber(ea.itemsCompleted)} finished stories had time estimates`
            : 'No finished stories with time estimates in this period'
        }
        icon={Target}
        cols={2}
        stats={[
          {
            label: 'Actual vs. planned',
            value: (
              <Hint
                content={
                  ea.avgRatio !== null
                    ? `Actual ÷ estimate: ${formatRatio(ea.avgRatio)}`
                    : undefined
                }
              >
                <span tabIndex={ea.avgRatio !== null ? 0 : undefined}>
                  {formatOverUnder(ea.avgRatio)}
                </span>
              </Hint>
            ),
          },
          { label: 'Finished near estimate (±20%)', value: formatPercent(ea.onTargetPct) },
        ]}
      >
        <div
          className="h-3.5 overflow-hidden rounded-[4px] bg-sidebar"
          role="meter"
          aria-label="Share of items on target"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((ea.onTargetPct ?? 0) * 100)}
        >
          <div
            className="h-full rounded-[4px] bg-col-done"
            style={{ width: `${Math.min(100, (ea.onTargetPct ?? 0) * 100)}%` }}
          />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full bg-col-done" />
          Finished within 20% of the estimate
        </p>
      </PlanCard>
      <PlanCard
        onOpen={onOpenWarnings}
        title="Delay Warning Signs"
        description="What triggered the delay alert"
        icon={TriangleAlert}
      >
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warning signs in this period.</p>
        ) : (
          <BarList
            label="Delayed items by flag"
            items={flags.map((f) => ({
              key: f.flag,
              label: WARNING_LABELS[f.flag] ?? delayFlagLabel(f.flag),
              value: f.count,
              display: formatNumber(f.count),
              barClass: 'bg-warn',
            }))}
          />
        )}
      </PlanCard>
    </div>
  );
}

function BodySkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading metrics…</span>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
