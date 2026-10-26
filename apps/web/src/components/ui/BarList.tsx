import { Hint } from './Tooltip';
import clsx from 'clsx';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  display: string;
  /** Tailwind background class for the bar. */
  barClass?: string;
}

/** Horizontal bars rendered as a semantic list — readable without the visuals. */
export function BarList({ items, label }: { items: BarListItem[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
        >
          <Hint content={item.label}>
            <span className="truncate text-[13px] text-ink-soft">{item.label}</span>
          </Hint>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-sidebar">
            <span
              className={clsx('block h-full rounded-full', item.barClass ?? 'bg-series-1')}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </span>
          <span className="min-w-8 text-right text-[13px] font-semibold text-ink tabular-nums">
            {item.display}
          </span>
        </li>
      ))}
    </ul>
  );
}
