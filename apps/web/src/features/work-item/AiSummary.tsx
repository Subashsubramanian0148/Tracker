import type { WorkItemAiSummary } from '@ado-metrics/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChartPie, Hourglass, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { formatShortDate } from '../../lib/format';
import { isApiError } from '../../api/client';

const OWNER_LABEL: Record<WorkItemAiSummary['delayOwner'], string> = {
  'UX team': 'Delay on UX',
  Others: 'Not the UX team',
  None: 'No delay',
  Unclear: 'Unclear',
};
const OWNER_TONE: Record<WorkItemAiSummary['delayOwner'], string> = {
  'UX team': 'bg-danger/10 text-danger',
  Others: 'bg-amber-50 text-amber-800',
  None: 'bg-emerald-50 text-emerald-700',
  Unclear: 'bg-muted text-ink-soft',
};

/** The four beats of the scan, one label each, shown under the scene. */
const PHASES = [
  'Reading the story',
  'Picking out what matters',
  'Connecting who did what',
  'Writing the summary',
];
const PHASE_MS = 950;

/** Time between timeline events as the history plays out, oldest first. */
const STEP_MS = 450;
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Shortest time the scan shows before the result: all four beats. */
const MIN_SCAN_MS = PHASES.length * PHASE_MS + 200;

/** Text lines of the "story" in a 260×140 scene: y, x, width. */
const LINES = [
  { y: 28, x: 24, w: 212 },
  { y: 50, x: 24, w: 180 },
  { y: 72, x: 24, w: 200 },
  { y: 94, x: 24, w: 150 },
  { y: 116, x: 24, w: 96 },
];
/** Key words: where they sit in the text, then where they float as nodes. */
const KEYS = [
  { y: 28, x: 70, w: 44, nx: 56, ny: 34 },
  { y: 50, x: 128, w: 40, nx: 200, ny: 30 },
  { y: 72, x: 36, w: 46, nx: 40, ny: 104 },
  { y: 72, x: 160, w: 34, nx: 214, ny: 98 },
  { y: 94, x: 88, w: 38, nx: 128, ny: 120 },
];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [0, 4],
  [1, 4],
];
const CX = 130;
const CY = 70;
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

/**
 * The AI at work, in four beats: lines of the story appear under a scanning glow; the key
 * words light up; they lift off as connected nodes; the nodes draw into one glowing core.
 * The result card then takes its place.
 */
function Analysing() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((n) => Math.min(n + 1, PHASES.length - 1)), PHASE_MS);
    return () => clearInterval(t);
  }, []);
  const reading = phase <= 1;
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-7">
      <div aria-hidden className="relative h-[140px] w-[260px] overflow-hidden">
        {/* The story text */}
        {LINES.map((l, i) => (
          <span
            key={i}
            className="keep-motion absolute h-1.5 animate-stream-in rounded-full bg-line transition-opacity duration-500"
            style={{
              top: l.y - 3,
              left: l.x,
              width: l.w,
              opacity: reading ? 1 : 0,
              animationDelay: `${i * 140}ms`,
            }}
          />
        ))}

        {/* Scanning highlight sweeping across while it reads */}
        {reading ? (
          <span className="keep-motion absolute inset-y-2 left-0 w-16 animate-ai-scan bg-gradient-to-r from-transparent via-primary/8 to-transparent" />
        ) : null}

        {/* Links between the ideas */}
        <svg viewBox="0 0 260 140" className="absolute inset-0 size-full">
          {EDGES.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={KEYS[a]!.nx}
              y1={KEYS[a]!.ny}
              x2={KEYS[b]!.nx}
              y2={KEYS[b]!.ny}
              className="keep-motion stroke-primary/20 transition-opacity duration-500"
              strokeWidth={1}
              style={{ opacity: phase === 2 ? 1 : 0 }}
            />
          ))}
        </svg>

        {/* Key words: glow in place, lift into nodes, then draw into the core */}
        {KEYS.map((k, i) => {
          const node = phase >= 2;
          const x = phase === 3 ? CX : node ? k.nx : k.x + k.w / 2;
          const y = phase === 3 ? CY : node ? k.ny : k.y;
          const w = node ? 10 : k.w;
          return (
            <span
              key={i}
              className={clsx(
                'keep-motion absolute rounded-full',
                phase >= 1
                  ? 'bg-primary/35 shadow-[0_0_8px_color-mix(in_oklab,var(--color-primary)_25%,transparent)]'
                  : 'bg-line',
              )}
              style={{
                left: x - w / 2,
                top: y - (node ? 5 : 3),
                width: w,
                height: node ? 10 : 6,
                opacity: phase === 0 ? 0 : phase === 3 ? 0 : 1,
                transition: `all 700ms ${EASE} ${i * 70}ms`,
              }}
            />
          );
        })}

        {/* The core the insights gather into */}
        <span
          className="keep-motion absolute rounded-full bg-primary/50 shadow-[0_0_20px_4px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]"
          style={{
            left: CX - 12,
            top: CY - 12,
            width: 24,
            height: 24,
            opacity: phase === 3 ? 1 : 0,
            transform: `scale(${phase === 3 ? 1 : 0.3})`,
            transition: `all 600ms ${EASE} 350ms`,
          }}
        >
          {phase === 3 ? (
            <span className="keep-motion absolute inset-0 animate-ping rounded-full bg-primary/20" />
          ) : null}
        </span>
      </div>
      <p key={phase} className="mt-3 animate-stream-in text-sm text-muted-foreground">
        {PHASES[phase]}…
      </p>
    </div>
  );
}

export type AiSummaryMutation = UseMutationResult<WorkItemAiSummary, Error, void>;

/** The Summarise button; sits in the story's summary card. */
export function SummariseButton({ summary }: { summary: AiSummaryMutation }) {
  const has = !!summary.data;
  return (
    <button
      type="button"
      onClick={() => summary.mutate()}
      disabled={summary.isPending}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white shadow-cta hover:opacity-90 disabled:opacity-60"
    >
      {has ? (
        <RefreshCw aria-hidden className="size-3.5" />
      ) : (
        <Sparkles aria-hidden className="size-3.5" />
      )}
      {summary.isPending ? 'Summarising…' : has ? 'Refresh summary' : 'Summarise with AI'}
    </button>
  );
}

/** The AI summary of the story, its tasks and its parent; shows once someone asks for it. */
export function AiSummary({ summary }: { summary: AiSummaryMutation }) {
  const s = summary.data;
  // Keep the scan on screen for a moment even when the answer is cached, so it reads as a step.
  const started = summary.submittedAt;
  const [shownFor, setShownFor] = useState(0);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setShownFor(started), MIN_SCAN_MS);
    return () => clearTimeout(t);
  }, [started]);
  const scanning = summary.isPending || (started > 0 && shownFor !== started && !summary.isError);
  if (!s && !scanning && !summary.isError) return null;
  return (
    <section
      aria-labelledby="wi-ai"
      aria-busy={scanning}
      className="mt-4 rounded-2xl border border-line bg-sidebar/50 p-3 shadow-soft"
    >
      <h3
        id="wi-ai"
        className="flex items-center gap-2 px-3 pt-2 pb-3 text-lg font-semibold tracking-tight text-ink"
      >
        <Sparkles aria-hidden className="size-4 text-primary" />
        Work summary
      </h3>
      {scanning ? (
        <div className="rounded-xl border border-line bg-card">
          <Analysing />
        </div>
      ) : null}

      {summary.isError && !scanning ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {isApiError(summary.error)
            ? summary.error.message
            : 'Could not get a summary. Try again.'}
        </p>
      ) : null}

      {s && !scanning ? <SummaryResult s={s} /> : null}
    </section>
  );
}

/** Timeline events grouped under their day, so each date shows once. */
function byDay(timeline: WorkItemAiSummary['timeline']) {
  const days: { date: string; events: { event: string; i: number }[] }[] = [];
  timeline.forEach((t, i) => {
    const last = days.at(-1);
    if (last?.date === t.date) last.events.push({ event: t.event, i });
    else days.push({ date: t.date, events: [{ event: t.event, i }] });
  });
  return days;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const TICKS = 22;

/** A half-ring of ticks: UX's share in blue from the left, the wait in amber after it. */
function SplitGauge({ ux, others }: { ux: number; others: number }) {
  const total = ux + others;
  const uxTicks = Math.round((ux / total) * TICKS);
  return (
    <svg viewBox="0 0 120 66" className="h-24 w-44 shrink-0" aria-hidden>
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = 180 + (180 / (TICKS - 1)) * i;
        const isUx = i < uxTicks;
        return (
          <g key={i} transform={`rotate(${angle} 60 60)`}>
            <rect
              x={60 + 44}
              y={60 - 3}
              width={14}
              height={6}
              rx={3}
              className={clsx(
                'keep-motion origin-center animate-tick-in [transform-box:fill-box]',
                isUx ? 'fill-primary' : 'fill-amber-400',
              )}
              style={{
                // Wait for the card to fade in, then sweep left to right.
                animationDelay: `${400 + i * 90}ms`,
                opacity: isUx
                  ? 0.55 + (0.45 * (i + 1)) / Math.max(uxTicks, 1)
                  : 0.9 - (0.7 * (i - uxTicks)) / Math.max(TICKS - uxTicks, 1),
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Stacked like a work-summary widget: who, then where it stands with a gauge of whose move
 * the time was, then the next step. The history opens from Details.
 */
function SummaryResult({ s }: { s: WorkItemAiSummary }) {
  const [open, setOpen] = useState(false);
  const n = s.timeline.length;
  const split = s.split && s.split.ux + s.split.others > 0 ? s.split : null;
  return (
    <div className="animate-stream-in space-y-2.5">
      {/* Where it stands */}
      <div className="rounded-xl border border-line bg-card">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <ChartPie aria-hidden className="size-4 text-ink-soft" />
          <p className="flex-1 text-[15px] font-medium text-ink">Where it stands</p>
          {n > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-line bg-sidebar px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink"
            >
              {open ? 'Hide details' : 'Details'}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[17px] leading-snug font-semibold text-ink">{s.status}</p>
            {split ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-primary">{plural(split.ux, 'day')}</span> UX
                working ·{' '}
                <span className="font-medium text-amber-700">{plural(split.others, 'day')}</span>{' '}
                waiting on others
              </p>
            ) : null}
            {s.delayOwner !== 'Unclear' ? (
              <span
                className={clsx(
                  'mt-3 inline-block rounded-md px-2 py-0.5 text-xs font-semibold',
                  OWNER_TONE[s.delayOwner],
                )}
              >
                {OWNER_LABEL[s.delayOwner]}
              </span>
            ) : null}
          </div>
          {split ? <SplitGauge ux={split.ux} others={split.others} /> : null}
        </div>

        {open ? (
          <ol className="border-t border-line px-4 py-4">
            {byDay(s.timeline).map((d) => (
              <li key={`${d.date}-${d.events[0]!.i}`} className="flex gap-4 pb-3 last:pb-0">
                <span
                  className="w-14 shrink-0 animate-stream-in pt-px text-xs font-medium text-muted-foreground tabular-nums"
                  style={delay(d.events[0]!.i * STEP_MS)}
                >
                  {Number.isNaN(Date.parse(d.date)) ? d.date : formatShortDate(d.date)}
                </span>
                <ul className="min-w-0 flex-1 space-y-1.5 border-l border-line">
                  {d.events.map((e) => (
                    <li
                      key={e.i}
                      className="relative animate-stream-in pl-4 text-sm text-ink"
                      style={delay(e.i * STEP_MS)}
                    >
                      <span
                        aria-hidden
                        className={clsx(
                          'absolute top-[7px] -left-[4.5px] size-2 rounded-full',
                          e.i === n - 1 ? 'bg-primary ring-4 ring-primary/15' : 'bg-primary/60',
                        )}
                      />
                      {e.event}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* What next */}
      {s.waitingOn || s.nextStep ? (
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          {s.waitingOn ? (
            <p className="flex items-start gap-2 text-sm text-ink">
              <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                <span className="font-semibold">
                  Waiting on {s.waitingOn.party}
                  {s.waitingOn.since ? ` since ${formatShortDate(s.waitingOn.since)}` : ''}.
                </span>{' '}
                <span className="text-ink-soft">{s.waitingOn.reason}</span>
              </span>
            </p>
          ) : null}
          {s.nextStep ? (
            <>
              <p className={clsx('text-xs text-muted-foreground', s.waitingOn && 'mt-3')}>
                Next step
              </p>
              <p className="mt-1 text-[15px] text-ink">{s.nextStep}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
