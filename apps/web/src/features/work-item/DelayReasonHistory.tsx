import type { DelayReason } from '@ado-metrics/shared';
import clsx from 'clsx';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime, formatNumber } from '../../lib/format';

export function DelayReasonHistory({ reasons }: { reasons: DelayReason[] }) {
  if (reasons.length === 0)
    return <p className="text-sm text-muted-foreground">No delay reasons recorded yet.</p>;
  const sorted = [...reasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <ol className="space-y-3">
      {sorted.map((r) => {
        const superseded = r.supersededAt !== null;
        return (
          <li
            key={r.id}
            className={clsx(
              'rounded-2xl border border-line p-4',
              superseded ? 'bg-sidebar text-muted-foreground' : 'bg-surface',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={superseded ? 'neutral' : 'amber'}>{r.category.name}</Badge>
              {r.impactDays !== null ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Impact {formatNumber(r.impactDays, 1)}d
                </span>
              ) : null}
              {superseded ? (
                <Badge>Superseded {formatDateTime(r.supersededAt)}</Badge>
              ) : (
                <Badge tone="success">Current</Badge>
              )}
            </div>
            <p
              className={clsx(
                'mt-2 text-sm break-words whitespace-pre-wrap',
                superseded ? 'text-muted-foreground' : 'text-ink',
              )}
            >
              {r.comment}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar name={r.createdBy.displayName} seed={r.createdBy.id} size="xs" />
              {r.createdBy.displayName} · {formatDateTime(r.createdAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
