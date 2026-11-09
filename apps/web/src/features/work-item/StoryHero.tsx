import type { WorkItemDetail } from '@ado-metrics/shared';
import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { effortEstimate } from './effortEstimate';
import { formatShortDate, typeShortCode } from '../../lib/format';

type Stage = 'not-started' | 'wip' | 'review' | 'handover';

const STAGE_LABEL: Record<Stage, string> = {
  'not-started': 'Not started',
  wip: 'In progress',
  review: 'In review',
  handover: 'Handed over',
};

const STAGE_TONE: Record<Stage, string> = {
  'not-started': 'bg-muted text-ink-soft',
  wip: 'bg-primary/10 text-primary',
  review: 'bg-violet-100 text-violet-700',
  handover: 'bg-emerald-100 text-emerald-700',
};

function stageOf(item: WorkItemDetail): Stage {
  switch (item.stateCategory) {
    case 'Completed':
      return 'handover';
    case 'Resolved':
      return 'review';
    case 'InProgress':
      return 'wip';
    default:
      return 'not-started';
  }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

interface Props {
  item: WorkItemDetail;
  days: number | null;
  /** Short names of what needs a look (late reasons first, then data issues). */
  attention: string[];
  /** Sprint name, "Internal task", or null when there is none. */
  sprint: string | null;
  /** Optional action shown at the card's top right (e.g. Summarise). */
  action?: ReactNode;
}

/** The top of a story: what it is, where it stands, and the few facts people look for first. */
export function StoryHero({ item, days, sprint, attention, action }: Props) {
  const stage = stageOf(item);
  const steps = [
    { label: 'Received', at: item.createdDate, done: true },
    { label: 'Started', at: item.activatedDate, done: !!item.activatedDate },
    {
      label: 'Handed over',
      at: item.completedDate,
      done: stage === 'handover',
    },
  ];

  const estimate = effortEstimate(item);
  const tasks = {
    total: item.children.length,
    done: item.children.filter((c) => c.stateCategory === 'Completed').length,
  };

  return (
    <header className="mt-5 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      {/* Top: what it is and where it stands; the action in its own column. */}
      <div className="flex flex-col sm:flex-row">
        <div className="min-w-0 flex-1 px-6 py-6 sm:px-8 sm:py-7">
          <p className="text-sm text-muted-foreground tabular-nums">
            {typeShortCode(item.type)} · {item.id}
          </p>
          <h2
            id="wi-title"
            className="mt-2 text-[28px] leading-tight font-semibold tracking-tight break-words text-ink"
          >
            {item.title}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              title={`Azure status: ${item.state}`}
              className={clsx(
                'rounded-full border border-line px-3 py-1 text-sm font-semibold shadow-soft',
                STAGE_TONE[stage],
              )}
            >
              {STAGE_LABEL[stage]}
            </span>
            <Health late={item.isDelayed} attention={attention} />
          </div>
        </div>
        {action ? (
          <div className="flex items-center justify-center border-t border-line px-8 py-5 sm:border-t-0 sm:border-l">
            {action}
          </div>
        ) : null}
      </div>

      {/* Bottom band: the dates and people, label over value. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line bg-sidebar/60 px-6 py-5 sm:px-8 lg:grid-cols-6">
        {steps.map((s, i) => (
          <Fact key={s.label} label={s.label}>
            {s.at
              ? formatShortDate(s.at)
              : i === 2 && item.dueDate
                ? `Due ${formatShortDate(item.dueDate)}`
                : 'Not yet'}
          </Fact>
        ))}
        <Fact label="Who is working">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Avatar name={item.assignedTo?.displayName} seed={item.assignedTo?.id} size="xs" />
            <span className="truncate">{item.assignedTo?.displayName ?? 'Unassigned'}</span>
          </span>
          {tasks.total > 0 ? (
            <Sub>
              {tasks.done} of {plural(tasks.total, 'task')} done
            </Sub>
          ) : null}
        </Fact>
        <Fact label="Sprint">
          {sprint ?? '—'}
          {sprint && item.iterationFromParent ? <Sub>from parent</Sub> : null}
        </Fact>
        <Fact label={stage === 'handover' ? 'Days taken' : 'Days so far'}>
          {estimate && days !== null ? (
            <DaysVsEstimate days={days} estimate={estimate.days} />
          ) : (
            <>
              {days !== null ? plural(days, 'day') : '—'}
              {!estimate && <Sub>No effort set</Sub>}
            </>
          )}
        </Fact>
        {item.blockedHours > 0 ? (
          <Fact label="Time stuck">{Math.round(item.blockedHours / 24)} days</Fact>
        ) : null}
        {item.reopenCount > 0 ? (
          <Fact label="Sent back">{plural(item.reopenCount, 'time')}</Fact>
        ) : null}
      </dl>
    </header>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-[15px] font-medium text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('block text-xs font-normal text-muted-foreground', className)}>
      {children}
    </span>
  );
}

/** Days used against the estimate: the number, one plain line, and a slim bar. */
function DaysVsEstimate({ days, estimate }: { days: number; estimate: number }) {
  const over = days - estimate;
  const pct = Math.min(100, (days / estimate) * 100);
  return (
    <>
      {plural(days, 'day')}
      <span className="mt-2 block h-1.5 max-w-48 overflow-hidden rounded-full bg-sidebar">
        <span
          className={clsx('block h-full rounded-full', over > 0 ? 'bg-danger' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <Sub className={over > 0 ? 'font-medium text-danger' : undefined}>
        {over > 0
          ? `Estimated ${plural(estimate, 'day')} · ${over} over`
          : `Estimated ${plural(estimate, 'day')} · ${plural(estimate - days, 'day')} left`}
      </Sub>
    </>
  );
}

/** A small chip saying what needs a look; it jumps to the details below. */
function Health({ late, attention }: { late: boolean; attention: string[] }) {
  if (!late && attention.length === 0) return null;
  const n = attention.length;
  return (
    <a
      href="#needs-attention"
      title={attention.join(' · ')}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold hover:underline',
        late ? 'bg-danger/10 text-danger' : 'bg-amber-50 text-amber-700',
      )}
    >
      <CircleAlert aria-hidden className="size-3.5" />
      {late ? 'Late' : `${n} ${n === 1 ? 'thing' : 'things'} to fix`}
    </a>
  );
}
