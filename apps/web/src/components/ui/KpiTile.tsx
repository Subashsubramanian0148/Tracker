import clsx from 'clsx';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { Hint } from './Tooltip';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  tone?: 'default' | 'warn' | 'good';
  /** Plain-English explanation shown in an info tooltip next to the label. */
  info?: string;
  className?: string;
}

export function KpiTile({
  label,
  value,
  hint,
  icon,
  loading,
  tone = 'default',
  info,
  className,
}: KpiTileProps) {
  return (
    <div
      className={clsx(
        'flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-display text-[13px] leading-snug font-medium text-muted-foreground">
          {label}
        </p>
        {info ? (
          <Hint content={info}>
            <button
              type="button"
              aria-label={`About ${label}: ${info}`}
              className="-m-1 shrink-0 cursor-help rounded-full p-1 text-faint hover:text-foreground"
            >
              <Info aria-hidden className="size-3.5" />
            </button>
          </Hint>
        ) : icon ? (
          <span className="text-faint">{icon}</span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p
          className={clsx(
            'mt-2 font-number text-[28px] leading-none font-semibold tracking-tight tabular-nums',
            tone === 'warn' && 'text-warn-strong',
            tone === 'good' && 'text-success',
          )}
        >
          {value}
        </p>
      )}
      {hint && !loading ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
