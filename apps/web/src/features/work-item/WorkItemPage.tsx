import { Hint } from '../../components/ui/Tooltip';
import type { EstimateSummary, WorkItemDetail } from '@ado-metrics/shared';
import clsx from 'clsx';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  GitCompareArrows,
  ListTree,
  MessageSquare,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { isApiError } from '../../api/client';
import { useWorkItem } from '../../api/workItems';
import { NotFoundPage } from '../../app/ErrorPages';
import { useProject } from '../../app/projectContext';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Card as BaseCard } from '../../components/ui/Card';
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
  const hasHistory = item.timeInState.some((t) => t.hours > 0);
  const midWork = item.changes.filter((c) => c.afterWorkStarted);
  // Delay reasons matter once something is late or already explained.
  const showDelay = item.isDelayed || item.delayReasons.length > 0;

  // Only the signals that say something about this item; zeros and blanks are left out.
  const signals = [
    item.cycleTimeDays !== null ? (
      <KpiChip key="cycle" label="Cycle time" value={formatDays(item.cycleTimeDays)} />
    ) : null,
    item.leadTimeDays !== null ? (
      <KpiChip key="lead" label="Lead time" value={formatDays(item.leadTimeDays)} />
    ) : null,
    item.blockedHours > 0 ? (
      <KpiChip key="blocked" label="Blocked" value={formatHours(item.blockedHours)} warn />
    ) : null,
    item.reopenCount > 0 ? (
      <KpiChip key="reopen" label="Reopened" value={`${item.reopenCount}×`} warn />
    ) : null,
    item.commentDelayDays > 0 ? (
      <KpiChip
        key="comments"
        label="Delay from comments"
        value={formatDays(item.commentDelayDays)}
        warn
        title="Time between reopen or blocked comments and the next done or unblocked comment"
      />
    ) : null,
    item.sprintsSpanned.length > 1 ? (
      <KpiChip
        key="sprints"
        label="Sprints spanned"
        value={formatNumber(item.sprintsSpanned.length)}
        warn
        title={item.sprintsSpanned.join(', ')}
      />
    ) : null,
  ].filter(Boolean);

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
              {/* A path with no sprint segment is just the project: no sprint to show. */}
              {item.iterationPath?.includes('\\') ? (
                <Meta label="Sprint">{item.iterationPath.split('\\').pop()}</Meta>
              ) : null}
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
        {signals.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Key metrics">
            {signals}
          </ul>
        ) : null}
      </Card>

      <DeliveryCard item={item} />

      <Card>
        <CardHeader title="Story" icon={FileText} />
        {item.description || item.acceptanceCriteria ? (
          <>
            {item.description ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
                {item.description}
              </p>
            ) : null}
            {item.acceptanceCriteria ? (
              <div className={clsx(item.description && 'mt-5')}>
                <h4 className="mb-1.5 text-[13px] font-semibold text-ink">Acceptance criteria</h4>
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
                  {item.acceptanceCriteria}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No description yet. The Description and Acceptance Criteria fields from Azure DevOps
            show here.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Changes during work"
          icon={GitCompareArrows}
          description="What changed after work started: scope, requirements, owner or sprint"
        />
        {midWork.length > 0 ? (
          <ChangesTable changes={midWork} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing changed after work started. Edits to effort, requirements, owner or sprint made
            while in progress will list here.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Comments"
          icon={MessageSquare}
          description="From Azure DevOps, including the completion note"
        />
        <AzureComments comments={item.comments} />
      </Card>

      {showDelay ? (
        <section
          id="delay-reason"
          tabIndex={-1}
          aria-labelledby="delay-reason-title"
          className="scroll-mt-4 rounded-2xl border border-line bg-surface p-6 outline-none"
        >
          <SectionTitle id="delay-reason-title" icon={TriangleAlert} title="Delay reasons" />
          <div className={clsx('grid gap-6', canAdd && 'lg:grid-cols-2')}>
            <DelayReasonHistory reasons={item.delayReasons} />
            {canAdd ? (
              <div className="rounded-2xl bg-sidebar p-5">
                <DelayReasonForm projectId={projectId} workItemId={item.id} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasHistory ? (
        <Card>
          <CardHeader
            title="Time in each state"
            icon={Clock}
            description="Where this item spent its time"
          />
          <StateTimeline segments={item.stateTimeline} />
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {item.timeInState.map((t) => (
              <li key={t.state} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={clsx('size-2.5 rounded-full', STATE_CATEGORY_BG[t.category])}
                />
                <span className="text-muted-foreground">{t.state}</span>
                <span className="font-medium tabular-nums">{formatHours(t.hours)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {hasEstimate(item.estimate) ? <EstimateCard estimate={item.estimate} /> : null}

      {item.children.length > 0 ? (
        <Card>
          <CardHeader
            title="Children"
            icon={ListTree}
            description={`${item.children.length} linked items`}
          />
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

const FIGMA_URL = /https:\/\/(?:www\.)?figma\.com\/[^\s)"'<>\]]+/g;

/** Latest Figma link mentioned in the story or its comments (the hand-off is usually last). */
export function findFigmaLink(item: WorkItemDetail): string | null {
  const texts = [item.description, item.acceptanceCriteria, ...item.comments.map((c) => c.text)];
  const links = texts.flatMap((t) => (t ? (t.match(FIGMA_URL) ?? []) : []));
  return links.length ? safeExternalUrl(links[links.length - 1]!) : null;
}

/** Whole calendar days from start to finish, counting the start day. */
function daysBetween(fromIso: string, toIso: string): number {
  const day = 86_400_000;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.max(1, Math.round((to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0)) / day) + 1);
}

/** Who has it and when it started; once done, when it finished, how long it took, and the design. */
function DeliveryCard({ item }: { item: WorkItemDetail }) {
  const done = item.stateCategory === 'Completed';
  const figma = done ? findFigmaLink(item) : null;
  const days =
    item.activatedDate && item.completedDate
      ? daysBetween(item.activatedDate, item.completedDate)
      : null;
  return (
    <Card className="p-0!">
      <dl className="grid grid-cols-2 sm:grid-cols-5 [&>div]:border-line [&>div]:px-5 [&>div]:py-4 sm:[&>div+div]:border-l">
        <div>
          <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Assigned to
          </dt>
          <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium">
            <Avatar name={item.assignedTo?.displayName} seed={item.assignedTo?.id} size="xs" />
            <span className="truncate">{item.assignedTo?.displayName ?? 'Unassigned'}</span>
          </dd>
        </div>
        <Fact label="Start date">
          {item.activatedDate ? (
            formatShortDate(item.activatedDate)
          ) : (
            <Pending>Set when it moves to In progress</Pending>
          )}
        </Fact>
        <Fact label="End date">
          {done ? (
            formatShortDate(item.completedDate)
          ) : (
            <Pending>Set when it moves to Done</Pending>
          )}
        </Fact>
        <Fact label="Days to deliver">
          {days !== null ? (
            `${days} ${days === 1 ? 'day' : 'days'}`
          ) : (
            <Pending>Start to end, once done</Pending>
          )}
        </Fact>
        <div>
          <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Figma
          </dt>
          <dd className="mt-1.5 text-sm">
            {figma ? (
              <a
                href={figma}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open design
                <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <Pending>
                {done
                  ? 'Paste a figma.com link in a comment'
                  : 'Shown once done, from a figma.com link'}
              </Pending>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/** Muted hint saying what will fill a field and when. */
function Pending({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-normal text-muted-foreground">{children}</span>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** Cards on this page match the Overview: hairline border, no shadow, roomier padding. */
function Card({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
  return (
    <BaseCard className={clsx('rounded-2xl border-line p-6 shadow-none', className)} {...props} />
  );
}

/** Overview-style card heading: quiet icon tile, title and optional subtitle. */
function SectionTitle({
  icon: Icon,
  title,
  description,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-sidebar text-ink-soft">
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h3 id={id} className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

const CardHeader = SectionTitle;

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

/** True when there is an estimate, logged work, or an effort change worth showing. */
function hasEstimate(e: EstimateSummary): boolean {
  return (
    e.originalEstimateHours !== null ||
    e.completedWorkHours !== null ||
    e.estimateVsActualRatio !== null ||
    (e.initialEffort !== null && e.effort !== null && e.initialEffort !== e.effort)
  );
}

function EstimateCard({ estimate: e }: { estimate: EstimateSummary }) {
  const effortChanged =
    e.initialEffort !== null && e.effort !== null && e.initialEffort !== e.effort;
  return (
    <Card>
      <CardHeader title="Estimate vs actual" icon={Target} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {e.effort !== null ? (
          <Cell label={effortChanged ? 'Effort (initial → current)' : 'Effort'}>
            {effortChanged ? (
              <>
                {e.initialEffort} → <span className="text-warn-strong">{e.effort}</span>
              </>
            ) : (
              e.effort
            )}
          </Cell>
        ) : null}
        {e.originalEstimateHours !== null ? (
          <Cell label="Original estimate">{formatHours(e.originalEstimateHours)}</Cell>
        ) : null}
        {e.completedWorkHours !== null ? (
          <Cell label="Completed work">{formatHours(e.completedWorkHours)}</Cell>
        ) : null}
        {e.remainingWorkHours ? (
          <Cell label="Remaining">{formatHours(e.remainingWorkHours)}</Cell>
        ) : null}
        {e.estimateVsActualRatio !== null ? (
          <Cell label="Actual / estimate" className={ratioTone(e.estimateVsActualRatio)}>
            {formatRatio(e.estimateVsActualRatio)}
            <span className="sr-only">
              {e.estimateVsActualRatio > 1.2
                ? ' (over estimate)'
                : e.estimateVsActualRatio < 0.8
                  ? ' (under estimate)'
                  : ' (on target)'}
            </span>
          </Cell>
        ) : null}
      </dl>
    </Card>
  );
}

/** One filled estimate figure; empty ones are left out rather than shown as dashes. */
function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-sidebar px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={clsx('mt-1 text-lg font-semibold tabular-nums', className)}>{children}</dd>
    </div>
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
