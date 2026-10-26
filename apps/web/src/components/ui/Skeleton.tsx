import { cn } from '@/lib/utils';
import { Skeleton as ShadSkeleton } from '@/components/shadcn/skeleton';

export function Skeleton({ className }: { className?: string }) {
  return <ShadSkeleton aria-hidden className={cn('motion-reduce:animate-none', className)} />;
}

/** Screen-reader announcement + visual placeholder block. */
export function LoadingBlock({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-full min-h-24 w-full" />
    </div>
  );
}

export function SkeletonRows({ rows = 5, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
