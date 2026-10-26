import type { WorkItemSummary } from '@ado-metrics/shared';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import { WorkItemCard } from './WorkItemCard';

interface BoardColumnProps {
  title: string;
  barClass: string;
  items: WorkItemSummary[];
  projectId: string;
  now: number;
  loading?: boolean;
}

export function BoardColumn({ title, barClass, items, projectId, now, loading }: BoardColumnProps) {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  // The fade is only a hint that more cards are below; it hides at the end of the list.
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateFade, items.length]);

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-[calc(100dvh-20rem)] min-h-72 w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface sm:w-80 lg:w-auto lg:max-w-none lg:min-w-0"
    >
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span aria-hidden className={clsx('h-4 w-1 rounded-full', barClass)} />
        <h3 id={headingId} className="font-display text-[15px] font-semibold">
          {title}
        </h3>
        <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {loading ? '…' : items.length}
          <span className="sr-only"> items</span>
        </span>
      </header>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="relative h-full overflow-y-auto px-3 pb-3"
        >
          {loading ? (
            <div className="space-y-3" aria-hidden>
              <Skeleton className="h-40 rounded-[14px]" />
              <Skeleton className="h-40 rounded-[14px]" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing here
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <WorkItemCard item={item} projectId={projectId} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-2xl bg-linear-to-t from-surface via-surface/70 to-transparent transition-opacity',
            showFade ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </section>
  );
}
