import type { WorkItemSummary } from '@ado-metrics/shared';
import clsx from 'clsx';
import {
  CalendarCheck,
  Inbox,
  RotateCcw,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import {
  daysBetween,
  formatDate,
  formatShortDate,
  isOverdue,
  typeShortCode,
} from '../../lib/format';
import { isReopened, stageOf, STAGES } from './stages';

interface StoryCardProps {
  item: WorkItemSummary;
  projectId: string;
  now: number;
}

/** Step n of the team's stages, with that stage's name and colour. */
function progressOf(item: WorkItemSummary) {
  const key = stageOf(item);
  const index = STAGES.findIndex((s) => s.key === key);
  if (index < 0) return null;
  const stage = STAGES[index]!;
  return { step: index + 1, steps: STAGES.length, label: stage.label, color: stage.color };
}

function ago(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function tookText(days: number): string {
  if (days === 0) return 'done the same day';
  return `took ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** One row of the card. New details are added as more rows. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface/80 text-ink-soft">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 text-[13px] text-ink">{children}</dd>
      </div>
    </div>
  );
}

/**
 * The sprint end, unless that sprint ended before the story was created: then the sprint field
 * is a leftover, not a real deadline, so there is no expected date.
 */
export function expectedDate(item: WorkItemSummary): string | null {
  if (!item.dueDate) return null;
  return item.dueDate.slice(0, 10) >= item.createdDate.slice(0, 10) ? item.dueDate : null;
}

/** In-progress story: when it came in, who has it, how far along it is and when it is due. */
export function StoryCard({ item, projectId, now }: StoryCardProps) {
  const progress = progressOf(item);
  const due = expectedDate(item);
  const overdue = isOverdue(due, now, item.stateCategory === 'Completed');
  const received = daysBetween(item.createdDate, now) ?? 0;
  // Handed over: how long it took matters, not how long ago it arrived.
  const done = item.stateCategory === 'Completed';
  const took = done
    ? daysBetween(item.createdDate, item.completedDate ? Date.parse(item.completedDate) : now)
    : null;
  const dateOf = (iso: string) =>
    new Date(iso).getFullYear() === new Date(now).getFullYear()
      ? formatShortDate(iso)
      : formatDate(iso);

  return (
    <Link
      to={`/projects/${encodeURIComponent(projectId)}/work-items/${item.id}`}
      className="group flex h-full flex-col rounded-2xl bg-tile p-5 transition-colors hover:bg-tile-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-surface/80 px-2 py-0.5 font-display text-[11px] font-semibold tracking-wide text-ink-soft tabular-nums">
          {typeShortCode(item.type)} · {item.id}
        </span>
        {isReopened(item) ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
            <RotateCcw aria-hidden className="size-3" />
            Reopened
          </span>
        ) : null}
        {item.isDelayed ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-ink">
            <TriangleAlert aria-hidden className="size-3" />
            Delayed
          </span>
        ) : null}
      </div>
      <h3 className="mt-2.5 line-clamp-2 font-display text-[15px] leading-snug font-semibold text-ink">
        {item.title}
      </h3>

      <dl className="mt-4 space-y-3.5">
        <Fact icon={Inbox} label="Received">
          {dateOf(item.createdDate)}{' '}
          <span className="text-muted-foreground">
            · {done ? tookText(took ?? 0) : ago(received)}
          </span>
        </Fact>

        <Fact icon={UserRound} label="Assigned to">
          {item.assignedTo ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={item.assignedTo.displayName} seed={item.assignedTo.id} size="xs" />
              <span className="truncate">{item.assignedTo.displayName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nobody yet</span>
          )}
        </Fact>

        <div>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Progress
            </span>
            <span className="flex items-center gap-1.5 text-ink">
              {progress ? (
                <>
                  <span aria-hidden className={clsx('size-2 rounded-full', progress.color)} />
                  {progress.label}{' '}
                  <span className="text-muted-foreground tabular-nums">
                    · step {progress.step} of {progress.steps}
                  </span>
                </>
              ) : (
                item.state
              )}
            </span>
          </div>
          {progress ? (
            <div className="mt-2 flex gap-1" aria-hidden>
              {Array.from({ length: progress.steps }, (_, i) => (
                <span
                  key={i}
                  className={clsx(
                    'h-1.5 flex-1 rounded-full',
                    // Filled up to the current step, in the colour of the stage it is at.
                    i < progress.step ? progress.color : 'bg-surface',
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        <Fact icon={CalendarCheck} label={done ? 'Handed over' : 'Expected by'}>
          {done ? (
            item.completedDate ? (
              dateOf(item.completedDate)
            ) : (
              <span className="text-muted-foreground">Date not recorded</span>
            )
          ) : due ? (
            <span className={clsx(overdue && 'font-medium text-danger')}>
              {dateOf(due)}
              <span className={clsx(overdue ? 'text-danger' : 'text-muted-foreground')}>
                {' '}
                · {overdue ? 'past due' : 'sprint end'}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </Fact>
      </dl>
    </Link>
  );
}
