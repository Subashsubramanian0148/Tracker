import clsx from 'clsx';
import type { ReactNode } from 'react';

interface ChartFigureProps {
  title: string;
  /** One-sentence takeaway read by screen readers (and shown as a caption). */
  summary: string;
  /** Data table for assistive tech; charts themselves are aria-hidden. */
  table?: { columns: string[]; rows: (string | number)[][] };
  action?: ReactNode;
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartFigure({
  title,
  summary,
  table,
  action,
  legend,
  className,
  children,
}: ChartFigureProps) {
  return (
    <figure
      className={clsx(
        'flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-5',
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <figcaption className="mt-0.5 text-sm text-muted-foreground">{summary}</figcaption>
        </div>
        {action}
      </div>
      {legend}
      <div aria-hidden className="min-h-0 flex-1">
        {children}
      </div>
      {table && table.rows.length > 0 ? (
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}

export function LegendItem({
  color,
  label,
  shape = 'dot',
}: {
  color: string;
  label: string;
  shape?: 'dot' | 'bar';
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={clsx(shape === 'dot' ? 'size-2.5 rounded-full' : 'h-2.5 w-4 rounded-sm')}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
