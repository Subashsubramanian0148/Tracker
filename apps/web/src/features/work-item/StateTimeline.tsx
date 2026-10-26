import type { StateSegment } from '@ado-metrics/shared';
import clsx from 'clsx';
import { Tooltip } from '../../components/ui/Tooltip';
import { formatDateTime, formatHours } from '../../lib/format';
import { STATE_CATEGORY_BG } from '../../lib/labels';

/** Horizontal bar where each segment's width is proportional to time spent in that state. */
export function StateTimeline({ segments }: { segments: StateSegment[] }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.durationHours), 0);
  if (segments.length === 0 || total <= 0) {
    return <p className="text-sm text-muted-foreground">No state history recorded yet.</p>;
  }

  return (
    <div>
      <ol
        className="flex h-9 w-full gap-0.5 overflow-visible"
        aria-label="State timeline, oldest first"
      >
        {segments.map((s, i) => {
          const pct = (Math.max(0, s.durationHours) / total) * 100;
          const label = `${s.state}: ${formatHours(s.durationHours)}, from ${formatDateTime(s.enteredAt)} to ${
            s.exitedAt ? formatDateTime(s.exitedAt) : 'now'
          }`;
          return (
            <li
              key={`${s.state}-${s.enteredAt}-${i}`}
              className="flex min-w-1.5"
              style={{ width: `${pct}%` }}
            >
              <Tooltip
                className="w-full"
                content={
                  <>
                    <span className="block font-semibold">{s.state}</span>
                    <span className="block tabular-nums">{formatHours(s.durationHours)}</span>
                    <span className="block text-white/75">
                      {formatDateTime(s.enteredAt)} →{' '}
                      {s.exitedAt ? formatDateTime(s.exitedAt) : 'now'}
                    </span>
                  </>
                }
              >
                {(triggerProps) => (
                  <span
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    {...triggerProps}
                    className={clsx(
                      'block h-full w-full',
                      STATE_CATEGORY_BG[s.category],
                      i === 0 && 'rounded-l-full',
                      i === segments.length - 1 && 'rounded-r-full',
                      !s.exitedAt && 'opacity-80',
                    )}
                  />
                )}
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
