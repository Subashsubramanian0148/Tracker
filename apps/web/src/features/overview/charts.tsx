import type { OverviewMetrics } from '@ado-metrics/shared';
import { format } from 'date-fns';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipContentProps,
} from 'recharts';
import { ChartFigure, LegendItem } from '../../components/ui/ChartFigure';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, formatDays, formatShortDate } from '../../lib/format';

// Validated categorical slots (see styles tokens --color-series-*), fixed order.
const SERIES = ['#c8431e', '#2a78d6', '#1baf7a'] as const;
const AXIS = { fontSize: 12, fill: '#6b6b6b' };
const GRID = '#ececec';

/** Scatter allows at most 3 identities; everything else folds into "Other". */
function typeGroup(type: string): 0 | 1 | 2 {
  if (type === 'Product Backlog Item' || type === 'Issue') return 0;
  if (type === 'Bug') return 1;
  return 2;
}
const GROUP_LABELS = ['Backlog item (PBI / Issue)', 'Bug', 'Other (Task, Feature, Epic)'] as const;
const GROUP_SHAPES = ['circle', 'triangle', 'diamond'] as const;

interface ScatterDatum {
  x: number;
  y: number;
  id: number;
  title: string;
  type: string;
}

function ScatterTip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as ScatterDatum | undefined;
  if (!active || !d) return null;
  return (
    <div className="max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-ink">
        #{d.id} · {d.type}
      </p>
      <p className="mt-0.5 line-clamp-2 text-ink-soft">{d.title}</p>
      <p className="mt-1 text-muted-foreground tabular-nums">
        {formatDays(d.y)} · completed {format(d.x, 'd MMM yyyy')}
      </p>
    </div>
  );
}

export function CycleTimeScatter({
  metrics,
  projectId,
}: {
  metrics: OverviewMetrics;
  projectId: string;
}) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const out: ScatterDatum[][] = [[], [], []];
    for (const p of metrics.cycleTimeScatter) {
      out[typeGroup(p.type)]?.push({
        x: new Date(p.completedAt).getTime(),
        y: p.cycleTimeDays,
        id: p.workItemId,
        title: p.title,
        type: p.type,
      });
    }
    return out;
  }, [metrics.cycleTimeScatter]);

  const { median, p85, count } = metrics.cycleTime;
  const rows = metrics.cycleTimeScatter
    .slice(0, 200)
    .map((p) => [p.workItemId, p.type, formatDate(p.completedAt), formatDays(p.cycleTimeDays)]);

  return (
    <ChartFigure
      title="Delivery Time per Story"
      summary={
        count === 0
          ? 'No items completed in this range.'
          : `${count} items finished. Typical time: ${formatDays(median)} | Safe timeline: ${formatDays(p85)}.`
      }
      table={{ columns: ['Work item', 'Type', 'Completed', 'Cycle time'], rows }}
      legend={
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {GROUP_LABELS.map((l, i) => (
            <LegendItem key={l} color={SERIES[i] ?? SERIES[0]} label={l} />
          ))}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="w-4 border-t-2 border-dashed border-ink" /> Typical (
            {formatDays(median)})
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="w-4 border-t-2 border-dotted border-muted-foreground" />{' '}
            Safe Line ({formatDays(p85)})
          </span>
        </div>
      }
    >
      {count === 0 ? (
        <EmptyState
          title="No completed items"
          description="Completed items will appear here."
          className="py-8"
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart
            margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => format(v, 'd MMM')}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <YAxis
              type="number"
              dataKey="y"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              unit="d"
              width={48}
            />
            <ZAxis range={[64, 64]} />
            <Tooltip
              content={(props) => <ScatterTip {...props} />}
              cursor={{ strokeDasharray: '3 3' }}
            />
            {median !== null ? (
              <ReferenceLine
                y={median}
                stroke="#111111"
                strokeDasharray="6 4"
                label={{
                  value: `Typical (${formatDays(median)})`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#2b2b2b',
                }}
              />
            ) : null}
            {p85 !== null ? (
              <ReferenceLine
                y={p85}
                stroke="#6b6b6b"
                strokeDasharray="2 3"
                label={{
                  value: `Safe Line (${formatDays(p85)})`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#6b6b6b',
                }}
              />
            ) : null}
            {groups.map((data, i) =>
              data.length > 0 ? (
                <Scatter
                  key={GROUP_LABELS[i]}
                  name={GROUP_LABELS[i]}
                  data={data}
                  fill={SERIES[i]}
                  shape={GROUP_SHAPES[i]}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(d: { payload?: ScatterDatum }) => {
                    if (d.payload)
                      navigate(
                        `/projects/${encodeURIComponent(projectId)}/work-items/${d.payload.id}`,
                      );
                  }}
                />
              ) : null,
            )}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}

function ThroughputTip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as { weekStart: string; count: number } | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold">Week of {formatShortDate(d.weekStart)}</p>
      <p className="text-muted-foreground tabular-nums">{d.count} completed</p>
    </div>
  );
}

export function ThroughputChart({ metrics }: { metrics: OverviewMetrics }) {
  const data = metrics.throughput;
  const total = data.reduce((s, w) => s + w.count, 0);
  const avg = data.length ? total / data.length : 0;
  return (
    <ChartFigure
      title="Items Delivered per Week"
      summary={
        data.length
          ? `${total} items finished over ${data.length} weeks (avg ${avg.toFixed(1)} per week).`
          : 'No data for this range.'
      }
      table={{
        columns: ['Week starting', 'Completed'],
        rows: data.map((w) => [formatDate(w.weekStart), w.count]),
      }}
    >
      {data.length === 0 ? (
        <EmptyState title="No throughput yet" className="py-8" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={(v: string) => formatShortDate(v)}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={12}
            />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              content={(props) => <ThroughputTip {...props} />}
              cursor={{ fill: '#f3f3f4' }}
            />
            <Bar
              dataKey="count"
              fill={SERIES[0]}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  );
}
