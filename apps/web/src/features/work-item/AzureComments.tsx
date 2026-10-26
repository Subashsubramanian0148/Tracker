import type { CommentSignal, WorkItemComment } from '@ado-metrics/shared';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../lib/format';

const SIGNAL: Record<CommentSignal, { label: string; tone: 'amber' | 'success' }> = {
  REOPEN: { label: 'Reopen', tone: 'amber' },
  BLOCKED: { label: 'Blocked', tone: 'amber' },
  UNBLOCKED: { label: 'Unblocked', tone: 'success' },
  DONE: { label: 'Done', tone: 'success' },
};

/** Read-only discussion from Azure DevOps; keyword tags show what the delay signals were read from. */
export function AzureComments({ comments }: { comments: WorkItemComment[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No comments yet. The discussion from Azure DevOps shows here, with the completion note
        tagged Done.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-3">
          <Avatar name={c.author?.displayName} seed={c.author?.id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-semibold text-ink">{c.author?.displayName ?? 'Unknown'}</span>
              <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              {c.signals.map((s) => (
                <Badge key={s} tone={SIGNAL[s].tone}>
                  {SIGNAL[s].label}
                </Badge>
              ))}
            </p>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap text-ink-soft">{c.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
