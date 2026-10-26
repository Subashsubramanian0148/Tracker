import { Hint } from '../../components/ui/Tooltip';
import type { EstimateSummary, WorkItemDetail } from '@ado-metrics/shared';
import clsx from 'clsx';
import { ArrowLeft, ExternalLink, TriangleAlert } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { isApiError } from '../../api/client';
import { useWorkItem } from '../../api/workItems';
import { NotFoundPage } from '../../app/ErrorPages';
import { useProject } from '../../app/projectContext';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { canAddDelayReason, useMe } from '../../lib/auth';
import {
  formatDays,
  formatHours,
  formatNumber,
  formatRatio,
  formatShortDate,
  typeShortCode,
} from '../../lib/format';
import { delayFlagLabel, STATE_CATEGORY_BG, STATE_CATEGORY_PILL } from '../../lib/labels';
import { AzureComments } from './AzureComments';
import { ChangesTable } from './ChangesTable';
import { DelayReasonForm } from './DelayReasonForm';
import { DelayReasonHistory } from './DelayReasonHistory';
import { StateTimeline } from './StateTimeline';

/** Only allow https links out to Azure DevOps (defends against javascript: URLs). */
function safeExternalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function WorkItemPage() {
  const { project } = useProject();
  const params = useParams();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0 && id <= 2_147_483_647;
  const query = useWorkItem(project.id, valid ? id : 0);
  const location = useLocation();

  // Deep link from the Delays page: jump to the delay-reason form once content exists.
  useEffect(() => {
    if (location.hash === '#delay-reason' && query.data) {
      const el = document.getElementById('delay-reason');
      el?.scrollIntoView({ block: 'start' });
      el?.focus({ preventScroll: true });
    }
  }, [location.hash, query.data]);

  if (!valid) return <NotFoundPage title="Work item not found" />;
  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isApiError(query.error) && query.error.status === 404) {
      return (
        <NotFoundPage
          title="Work item not found"
          description="It may have been deleted, moved to another project, or not synced yet."
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <Detail item={query.data} projectId={project.id} />;
}

function Detail({ item, projectId }: { item: WorkItemDetail; projectId: string }) {
  const me = useMe();
  const url = safeExternalUrl(item.url);
  const canAdd = canAddDelayReason(me.user, item.assignedTo);
  const base = `/projects/${encodeURIComponent(projectId)}`;

  return (
    <article className="space-y-5" aria-labelledby="wi-title">
      <Link
        to={`${base}/board`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back to board
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-pill px-2 py-0.5 font-display text-xs font-semibold tabular-nums">
                {typeShortCode(item.type)} · {item.id}
              </span>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATE_CATEGORY_PILL[item.stateCategory],
                )}
              >
                {item.state}
              </span>
              {item.isDelayed ? (
                <Badge tone="amber" icon={<TriangleAlert aria-hidden className="size-3" />}>
                  Delayed
                </Badge>
              ) : null}
              {item.delayFlags.map((f) => (
                <Badge key={f}>{delayFlagLabel(f)}</Badge>
              ))}
            </div>
            <h2
              id="wi-title"
              className="mt-3 text-2xl leading-snug font-semibold tracking-tight break-words"
            >
              {item.title}
            </h2>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Meta label="Assignee">
                <span className="inline-flex items-center gap-2">
                  <Avatar
                    name={item.assignedTo?.displayName}
                    seed={item.assignedTo?.id}
                    size="xs"
                  />
                  {item.assignedTo?.displayName ?? 'Unassigned'}
                </span>
              </Meta>
              <Meta label="Type">{item.type}</Meta>
              <Meta label="Iteration">{item.iterationPath ?? '—'}</Meta>
              {item.dueDate ? (
                <Meta label="Sprint ends">{formatShortDate(item.dueDate)}</Meta>
              ) : null}
              {item.effort !== null ? <Meta label="Effort">{item.effort} pts</Meta> : null}
            </dl>
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 font-display text-sm font-medium hover:bg-sidebar"
            >
              Open in Azure DevOps
              <ExternalLink aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Key metrics">
          <KpiChip label="Cycle time" value={formatDays(item.cycleTimeDays)} />
          <KpiChip label="Lead time" value={formatDays(item.leadTimeDays)} />
          <KpiChip
            label="Blocked"
            value={formatHours(item.blockedHours)}
            warn={item.blockedHours > 0}
          />
          <KpiChip label="Reopened" value={`${item.reopenCount}×`} warn={item.reopenCount > 0} />
          <KpiChip
            label="Delay from comments"
            value={formatDays(item.commentDelayDays)}
            warn={item.commentDelayDays > 0}
            title="Time between reopen or blocked comments and the next done or unblocked comment"
          />
          <KpiChip
            label="Sprints spanned"
            value={formatNumber(item.sprintsSpanned.length)}
            warn={item.sprintsSpanned.length > 1}
            title={item.sprintsSpanned.join(', ')}
          />
        </ul>
      </Card>

      <Card>
        <CardHeader title="State timeline" description="Width shows time spent in each state" />
        <StateTimeline segments={item.stateTimeline} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Time in state" />
          {item.timeInState.length === 0 ? (
            <p className="text-sm text-muted-foreground">No state history.</p>
          ) : (
            <ul className="divide-y divide-line">
              {item.timeInState.map((t) => (
                <li
                  key={t.state}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={clsx('size-2.5 rounded-full', STATE_CATEGORY_BG[t.category])}
                    />
                    {t.state}
                  </span>
                  <span className="font-medium tabular-nums">{formatHours(t.hours)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <EstimateCard estimate={item.estimate} />
      </div>

      {item.description || item.acceptanceCriteria ? (
        <Card>
          {item.description ? (
            <>
              <CardHeader title="Description" />
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
                {item.description}
              </p>
            </>
          ) : null}
          {item.acceptanceCriteria ? (
            <div className={clsx(item.description && 'mt-6')}>
              <CardHeader title="Acceptance criteria" />
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
                {item.acceptanceCriteria}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Comments"
          description="From Azure DevOps. Tags show the words the delay signals were read from (reopen, blocked, done…)"
        />
        <AzureComments comments={item.comments} />
      </Card>

      <Card>
        <CardHeader
          title="Changes"
          description="Highlighted rows changed after work started (scope changes)"
        />
        <ChangesTable changes={item.changes} />
      </Card>

      <section
        id="delay-reason"
        tabIndex={-1}
        aria-labelledby="delay-reason-title"
        className="scroll-mt-4 rounded-2xl border border-line bg-surface p-5 outline-none"
      >
        <h3 id="delay-reason-title" className="mb-4 text-base font-semibold">
          Delay reasons
        </h3>
        <div className={clsx('grid gap-6', canAdd && 'lg:grid-cols-2')}>
          <DelayReasonHistory reasons={item.delayReasons} />
          {canAdd ? (
            <div className="rounded-2xl bg-sidebar p-5">
              <DelayReasonForm projectId={projectId} workItemId={item.id} />
            </div>
          ) : null}
        </div>
      </section>

      {item.children.length > 0 ? (
        <Card>
          <CardHeader title="Children" description={`${item.children.length} linked items`} />
          <ul className="divide-y divide-line">
            {item.children.map((c) => (
              <li key={c.id}>
                <Link
                  to={`${base}/work-items/${c.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-2 py-3 text-sm hover:bg-sidebar"
                >
                  <span className="rounded-md bg-pill px-2 py-0.5 font-display text-xs font-semibold tabular-nums">
                    {typeShortCode(c.type)} · {c.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STATE_CATEGORY_PILL[c.stateCategory],
                    )}
                  >
                    {c.state}
                  </span>
                  <span className="text-muted-foreground">
                    {c.assignedTo?.displayName ?? 'Unassigned'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

function KpiChip({
  label,
  value,
  warn,
  title,
}: {
  label: string;
  value: string;
  warn?: boolean;
  title?: string;
}) {
  return (
    <li>
      <Hint content={title}>
        <span
          tabIndex={title ? 0 : undefined}
          className={clsx(
            'inline-block rounded-full px-3.5 py-1.5 text-sm',
            warn ? 'bg-amber-soft text-amber-ink' : 'bg-sidebar text-ink-soft',
          )}
        >
          <span className="text-muted-foreground">{label}</span>{' '}
          <span className="font-semibold text-ink tabular-nums">{value}</span>
        </span>
      </Hint>
    </li>
  );
}

function ratioTone(r: number | null): string {
  if (r === null) return 'text-ink';
  if (r <= 1.2 && r >= 0.8) return 'text-success';
  if (r <= 1.5) return 'text-amber-ink';
  return 'text-danger';
}

function EstimateCard({ estimate: e }: { estimate: EstimateSummary }) {
  const effortChanged =
    e.initialEffort !== null && e.effort !== null && e.initialEffort !== e.effort;
  return (
    <Card>
      <CardHeader title="Estimate vs actual" />
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-sidebar px-3 py-3">
          <dt className="text-xs text-muted-foreground">Effort (initial → current)</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {e.initialEffort ?? '—'} →{' '}
            <span className={clsx(effortChanged && 'text-warn-strong')}>{e.effort ?? '—'}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-sidebar px-3 py-3">
          <dt className="text-xs text-muted-foreground">Actual / estimate</dt>
          <dd
            className={clsx(
              'mt-1 text-lg font-semibold tabular-nums',
              ratioTone(e.estimateVsActualRatio),
            )}
          >
            {formatRatio(e.estimateVsActualRatio)}
            {e.estimateVsActualRatio !== null ? (
              <span className="sr-only">
                {e.estimateVsActualRatio > 1.2
                  ? ' (over estimate)'
                  : e.estimateVsActualRatio < 0.8
                    ? ' (under estimate)'
                    : ' (on target)'}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-xl bg-sidebar px-3 py-3">
          <dt className="text-xs text-muted-foreground">Original estimate</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {formatHours(e.originalEstimateHours)}
          </dd>
        </div>
        <div className="rounded-xl bg-sidebar px-3 py-3">
          <dt className="text-xs text-muted-foreground">Completed work</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {formatHours(e.completedWorkHours)}
            {e.remainingWorkHours ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                +{formatHours(e.remainingWorkHours)} left
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading work item…</span>
      <Skeleton className="h-48" />
      <Skeleton className="h-28" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
