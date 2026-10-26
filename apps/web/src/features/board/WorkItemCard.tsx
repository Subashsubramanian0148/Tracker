import { Hint } from '../../components/ui/Tooltip';
import type { WorkItemSummary } from '@ado-metrics/shared';
import clsx from 'clsx';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import {
  daysBetween,
  formatDays,
  formatShortDate,
  isOverdue,
  typeShortCode,
} from '../../lib/format';
import { delayFlagLabel } from '../../lib/labels';

interface WorkItemCardProps {
  item: WorkItemSummary;
  projectId: string;
  now: number;
}

function secondaryLine(item: WorkItemSummary, now: number): string {
  if (item.stateCategory === 'Completed') {
    return `Cycle ${formatDays(item.cycleTimeDays)} · Lead ${formatDays(item.leadTimeDays)}`;
  }
  // The column already shows the state, so only say how long it has been there.
  if (item.activatedDate) {
    const d = daysBetween(item.activatedDate, now) ?? 0;
    return `Active ${d}d`;
  }
  const created = daysBetween(item.createdDate, now) ?? 0;
  return `Created ${created}d ago`;
}

/** Board card. The whole card is a link so it is keyboard navigable. */
export function WorkItemCard({ item, projectId, now }: WorkItemCardProps) {
  const done = item.stateCategory === 'Completed';
  const overdue = isOverdue(item.dueDate, now, done);
  const code = typeShortCode(item.type);
  const flagsText = item.delayFlags.map(delayFlagLabel).join(', ');

  return (
    <Link
      to={`/projects/${encodeURIComponent(projectId)}/work-items/${item.id}`}
      className="group block rounded-[14px] bg-tile p-4 transition-colors hover:bg-tile-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-surface/80 px-2 py-0.5 font-display text-[11px] font-semibold tracking-wide text-ink-soft tabular-nums">
            {code} · {item.id}
          </span>
          {item.isDelayed ? (
            <Hint content={flagsText}>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-ink">
                <TriangleAlert aria-hidden className="size-3" />
                Delayed
                {flagsText ? <span className="sr-only">: {flagsText}</span> : null}
              </span>
            </Hint>
          ) : null}
          {item.isDelayed && item.hasDelayReason ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
              <CircleCheck aria-hidden className="size-3" />
              Reason added
            </span>
          ) : null}
        </div>

        <h4 className="mt-2.5 line-clamp-2 font-display text-[15px] leading-snug font-semibold text-ink">
          {item.title}
        </h4>
        <p className="mt-1 truncate text-[13px] text-muted-foreground tabular-nums">
          {secondaryLine(item, now)}
          {item.dueDate ? (
            <>
              {' · '}
              <span className={clsx(overdue && 'font-medium text-danger')}>
                {overdue ? 'Overdue ' : 'Sprint ends '}
                {formatShortDate(item.dueDate)}
              </span>
            </>
          ) : null}
        </p>

        {item.assignedTo || item.effort !== null ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {item.assignedTo ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={item.assignedTo.displayName} seed={item.assignedTo.id} size="xs" />
                <span className="truncate text-[13px] text-ink-soft">
                  {item.assignedTo.displayName}
                </span>
              </span>
            ) : (
              <span />
            )}
            {item.effort !== null ? (
              <span className="shrink-0 text-[13px] font-medium text-ink-soft tabular-nums">
                {item.effort} {item.effort === 1 ? 'pt' : 'pts'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
