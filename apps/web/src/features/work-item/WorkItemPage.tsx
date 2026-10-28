import type { EstimateSummary, WorkItemDetail } from '@ado-metrics/shared';
import clsx from 'clsx';
import {
  CircleCheck,
  Paperclip,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Pencil,
  ArrowLeft,
  ExternalLink,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { isApiError } from '../../api/client';
import { useDismissDelay, useIgnoreComment, useWorkItem } from '../../api/workItems';
import { NotFoundPage } from '../../app/ErrorPages';
import { useProject } from '../../app/projectContext';
import { Avatar } from '../../components/ui/Avatar';
import { Card as BaseCard } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { canAddDelayReason, useMe } from '../../lib/auth';
import {
  formatHours,
  formatRatio,
  formatDateTime,
  formatShortDate,
  typeShortCode,
} from '../../lib/format';
import { STATE_CATEGORY_BG, STATE_CATEGORY_PILL } from '../../lib/labels';
import { AzureComments } from './AzureComments';
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
  const location = useLocation();
  // The delay-reason form stays closed until asked for (or deep-linked).
  const [formOpen, setFormOpen] = useState(location.hash === '#delay-reason');
  // The parent item (Related Work → Parent) when there is one, otherwise the story itself.
  const url = safeExternalUrl(
    item.parentId && item.url
      ? item.url.replace(/\/_workitems\/edit\/\d+$/, `/_workitems/edit/${item.parentId}`)
      : item.url,
  );
  const canAdd = canAddDelayReason(me.user, item.assignedTo);
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const hasHistory = item.timeInState.some((t) => t.hours > 0);
  // Delay reasons matter once something is late or already explained.
  const showDelay = item.isDelayed || item.delayReasons.length > 0;
  const done = item.stateCategory === 'Completed';
  const figma = done ? findFigmaLink(item) : null;
  // Finished: start to end. Still open: start to today.
  const days = item.activatedDate
    ? daysBetween(
        item.activatedDate,
        done && item.completedDate ? item.completedDate : new Date().toISOString(),
      )
    : null;
  // A path with no sprint segment is just the project: no sprint to show.
  const sprint = item.iterationPath?.includes('\\') ? item.iterationPath.split('\\').pop() : null;

  const lateReasons = buildLateReasons(item, sprint);
  const dataIssues = buildDataIssues(item, figma);
  const ignoreComment = useIgnoreComment(projectId, item.id);
  const dismiss = useDismissDelay(projectId, item.id);
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const doneTasks = item.children.filter((c) => c.stateCategory === 'Completed').length;

  // Comments have their own section; the metrics list only shows field changes.
  const changes = buildActivity(item).filter((e) => !e.key.startsWith('m'));

  return (
    <article aria-labelledby="wi-title">
      {/* Top bar: where you are, and the way out to Azure DevOps. */}
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            to={`${base}/board`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Board
          </Link>
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
          <span className="truncate font-medium text-ink">
            {typeShortCode(item.type)} · {item.id}
          </span>
        </nav>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-soft hover:bg-sidebar hover:text-ink"
          >
            {item.parentId ? 'Open parent in Azure DevOps' : 'Open in Azure DevOps'}
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>

      {/* 1. The story: what it is, when it started, who has it. */}
      <header className="mt-6">
        <h2
          id="wi-title"
          className="text-[28px] leading-tight font-semibold tracking-tight break-words"
        >
          {item.title}
        </h2>
        <dl className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Started</dt>
            <dd className="font-medium tabular-nums">
              {item.activatedDate ? formatShortDate(item.activatedDate) : 'Not started'}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Assigned to</dt>
            <dd className="inline-flex items-center gap-2 font-medium">
              <Avatar name={item.assignedTo?.displayName} seed={item.assignedTo?.id} size="xs" />
              {item.assignedTo?.displayName ?? 'Unassigned'}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span
                className={clsx(
                  'rounded-md px-2 py-0.5 text-[13px] font-medium',
                  STATE_CATEGORY_PILL[item.stateCategory],
                )}
              >
                {item.state}
              </span>
            </dd>
          </div>
        </dl>
        {item.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
            {item.tags.map((t) => (
              <li key={t} className="rounded-full bg-sidebar px-2.5 py-0.5 text-xs text-ink-soft">
                #{t}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {/* 2. Description. */}
      <section aria-labelledby="wi-desc" className="mt-8">
        <h3 id="wi-desc" className="text-base font-semibold">
          Description
        </h3>
        <div className="mt-3 rounded-xl border border-line px-5 py-4 text-sm leading-relaxed text-ink-soft">
          {item.description || item.acceptanceCriteria ? (
            <div className="space-y-4">
              {item.description ? (
                <p className="break-words whitespace-pre-wrap">{item.description}</p>
              ) : null}
              {item.acceptanceCriteria ? (
                <div>
                  <h4 className="mb-1 text-[13px] font-semibold text-ink">Acceptance criteria</h4>
                  <p className="break-words whitespace-pre-wrap">{item.acceptanceCriteria}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">No description in Azure DevOps.</p>
          )}
        </div>
        {figma ? (
          <a
            href={figma}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-3 rounded-xl border border-line py-2 pr-4 pl-2.5 text-sm hover:bg-sidebar"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-[11px] font-bold text-violet-600">
              fig
            </span>
            <span className="font-medium">Final design in Figma</span>
            <ExternalLink aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        {item.attachments.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
            {item.attachments.map((f) => (
              <li key={f.url}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sidebar"
                >
                  <Paperclip aria-hidden className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{f.name}</span>
                  {f.sizeBytes !== null ? (
                    <span className="text-xs text-muted-foreground">{fileSize(f.sizeBytes)}</span>
                  ) : null}
                  <span className="sr-only">(opens in Azure DevOps)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 3. Comments. */}
      <section aria-labelledby="wi-comments" className="mt-8">
        <h3 id="wi-comments" className="text-base font-semibold">
          Comments
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {item.comments.length}
          </span>
        </h3>
        <div className="mt-3">
          <AzureComments
            comments={item.comments}
            onIgnore={(commentId, ignored) => ignoreComment.mutate({ commentId, ignored })}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Only tagged comments count: start a comment with #blocked, #unblocked, #reopen or #done
            in Azure DevOps.
          </p>
        </div>
      </section>

      {item.children.length > 0 ? (
        <section aria-labelledby="wi-tasks" className="mt-8">
          <h3 id="wi-tasks" className="text-base font-semibold">
            Tasks
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {doneTasks} of {item.children.length} done
            </span>
          </h3>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sidebar" aria-hidden>
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${(doneTasks / item.children.length) * 100}%` }}
            />
          </div>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Child tasks</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-12 py-2 font-normal">#</th>
                <th className="py-2 font-normal">Task</th>
                <th className="hidden py-2 font-normal sm:table-cell">Owner</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {item.children.map((c, i) => (
                <tr key={c.id}>
                  <td className="py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <Link to={`${base}/work-items/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="hidden py-2.5 text-ink-soft sm:table-cell">
                    {c.assignedTo?.displayName ?? 'Unassigned'}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={clsx(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        STATE_CATEGORY_PILL[c.stateCategory],
                      )}
                    >
                      {c.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* 4. Then the metrics. */}
      <section aria-labelledby="wi-metrics" className="mt-12 border-t border-line pt-8">
        <h3 id="wi-metrics" className="text-base font-semibold">
          Metrics
        </h3>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={done ? 'Took' : 'Working on it for'}>
            {days !== null ? `${days} ${days === 1 ? 'day' : 'days'}` : '—'}
          </Stat>
          <Stat label="Finished on">{done ? formatShortDate(item.completedDate) : '—'}</Stat>
          <Stat label="Time spent working">{plainDays(item.cycleTimeDays)}</Stat>
          <Stat label="From request to done">{plainDays(item.leadTimeDays)}</Stat>
          <Stat label="Sprint">
            {sprint ?? '—'}
            {sprint && item.iterationFromParent && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">from parent</span>
            )}
          </Stat>
          <Stat label="Size">{item.effort !== null ? `${item.effort} points` : '—'}</Stat>
          <Stat label="Time stuck">
            {item.blockedHours > 0 ? plainHours(item.blockedHours) : 'Never'}
          </Stat>
          <Stat label="Sent back">
            {item.reopenCount > 0
              ? `${item.reopenCount} ${item.reopenCount === 1 ? 'time' : 'times'}`
              : 'Never'}
          </Stat>
        </dl>

        {dataIssues.length > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <TriangleAlert aria-hidden className="size-4" />
              Data check
            </h4>
            <ul className="mt-3 space-y-3 text-sm text-amber-900">
              {dataIssues.map((d) => (
                <li key={d.text}>
                  <p className="font-medium">
                    {d.text}
                    {d.excluded ? (
                      <span className="font-normal text-amber-700">
                        {' '}
                        · left out of team averages
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    <span className="font-medium">How to fix:</span> {d.fix}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-800">
              Once it’s fixed in Azure DevOps, this updates at the next sync.
            </p>
          </div>
        ) : null}

        {lateReasons.length > 0 ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Why it&apos;s flagged
                {item.dismissal ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    · not counted as late
                  </span>
                ) : null}
              </h4>
              {item.dismissal ? (
                <button
                  type="button"
                  onClick={() => dismiss.mutate(null)}
                  className="text-[13px] text-muted-foreground hover:text-ink hover:underline"
                >
                  Count as late again
                </button>
              ) : !dismissing ? (
                <button
                  type="button"
                  onClick={() => setDismissing(true)}
                  className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[13px] font-medium hover:bg-sidebar"
                >
                  Not really late
                </button>
              ) : null}
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {lateReasons.map((r) => (
                <li key={r.title} className="rounded-xl border border-line px-4 py-3">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.why}</p>
                </li>
              ))}
            </ul>
            {item.dismissal ? (
              <p className="mt-3 text-sm text-ink-soft">
                {item.dismissal.by} marked this as not really late: &ldquo;{item.dismissal.reason}
                &rdquo;
              </p>
            ) : dismissing ? (
              <form
                className="mt-3 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dismissReason.trim().length < 3) return;
                  dismiss.mutate(dismissReason.trim(), {
                    onSuccess: () => {
                      setDismissing(false);
                      setDismissReason('');
                    },
                  });
                }}
              >
                <label htmlFor="dismiss-reason" className="sr-only">
                  Why it wasn&apos;t really late
                </label>
                <input
                  id="dismiss-reason"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  maxLength={500}
                  placeholder="Planned to run into the next sprint"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={dismissReason.trim().length < 3 || dismiss.isPending}
                  className="h-9 rounded-lg bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setDismissing(false)}
                  className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:text-ink"
                >
                  Cancel
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {hasHistory ? (
          <div className="mt-8">
            <h4 className="text-sm font-semibold">Where the time went</h4>
            <div className="mt-3">
              <StateTimeline segments={item.stateTimeline} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {item.timeInState.map((t) => (
                <li key={t.state} className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className={clsx('size-2 rounded-full', STATE_CATEGORY_BG[t.category])}
                  />
                  <span className="text-muted-foreground">{t.state}</span>
                  <span className="font-medium tabular-nums">{plainHours(t.hours)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8">
          <h4 className="text-sm font-semibold">What changed while working</h4>
          {changes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
              {changes.map((e) => (
                <li key={e.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <e.icon
                    aria-hidden
                    className={clsx(
                      'size-4 shrink-0',
                      e.tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    {e.who ? <span className="font-medium">{e.who} </span> : null}
                    <span className="text-ink-soft">{e.what}</span>
                  </span>
                  <time dateTime={e.at} className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(e.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>

        {showDelay ? (
          <section
            id="delay-reason"
            tabIndex={-1}
            aria-labelledby="delay-reason-title"
            className="mt-8 scroll-mt-4 outline-none"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 id="delay-reason-title" className="text-sm font-semibold">
                Why it was late
              </h4>
              {canAdd && !formOpen ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium hover:bg-sidebar"
                >
                  <Plus aria-hidden className="size-3.5" />
                  Add reason
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <DelayReasonHistory reasons={item.delayReasons} />
            </div>
            {canAdd && formOpen ? (
              <div className="mt-4 rounded-2xl bg-sidebar p-5">
                <DelayReasonForm projectId={projectId} workItemId={item.id} />
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      {hasEstimate(item.estimate) ? (
        <div className="mt-10 border-t border-line pt-2">
          <EstimateCard estimate={item.estimate} />
        </div>
      ) : null}
    </article>
  );
}

/** The four plain reasons an item can be flagged, each with the fact behind it. */
function buildLateReasons(item: WorkItemDetail, sprint: string | null | undefined) {
  const f = new Set(item.delayFlags);
  const reasons: { title: string; why: string }[] = [];
  if (f.has('PAST_SPRINT_END') || f.has('CARRIED_OVER')) {
    reasons.push({
      title: 'Missed sprint',
      why: f.has('PAST_SPRINT_END')
        ? `${sprint ?? 'Its sprint'} ended ${formatShortDate(item.dueDate)} and it's still open.`
        : `Still unfinished when a sprint ended; ran across ${item.sprintsSpanned.length} sprints.`,
    });
  }
  if (f.has('CYCLE_TIME_OUTLIER')) {
    reasons.push({
      title: 'Took longer than usual',
      why: `${plainDays(item.cycleTimeDays)} of work, longer than 85% of recent ${item.type.toLowerCase()}s.`,
    });
  }
  if (f.has('LONG_BLOCKED') || f.has('BLOCKED_IN_COMMENTS')) {
    reasons.push({
      title: 'Stuck',
      why: f.has('LONG_BLOCKED')
        ? `Marked Blocked for ${plainHours(item.blockedHours)}.`
        : 'A #blocked comment with no #unblocked after it.',
    });
  }
  if (f.has('REOPENED') || f.has('REOPENED_IN_COMMENTS')) {
    reasons.push({
      title: 'Sent back',
      why:
        item.reopenCount > 0
          ? `Reopened after Done ${item.reopenCount} ${item.reopenCount === 1 ? 'time' : 'times'}.`
          : 'A #reopen comment asked for changes.',
    });
  }
  return reasons;
}

const STALE_DAYS = 14;

/** Signs the board wasn't kept up to date, so the numbers for this item may be off. */
function buildDataIssues(item: WorkItemDetail, figma: string | null) {
  const issues: { text: string; fix: string; excluded?: boolean }[] = [];
  const done = item.stateCategory === 'Completed';
  const worked = item.stateTimeline.some((s) => s.category === 'InProgress');
  if (done && (!worked || (item.cycleTimeDays !== null && item.cycleTimeDays * 24 < 1))) {
    issues.push({
      text: 'Moved straight to Done, so no working time was recorded.',
      fix: 'Next time, move the card to In progress when work starts, not only to Done at the end.',
      excluded: true,
    });
  }
  if (!done && item.comments.some((c) => !c.ignored && c.signals.includes('DONE'))) {
    issues.push({
      text: 'A #done comment says it’s finished, but the card is still open.',
      fix: 'Move the card to Done in Azure DevOps, or mark the comment “Not a real signal” below.',
    });
  }
  if (!done && item.activatedDate) {
    const last = Math.max(
      Date.parse(item.activatedDate),
      ...item.changes.map((c) => Date.parse(c.changedAt)),
      ...item.comments.map((c) => Date.parse(c.createdAt)),
    );
    const idle = Math.floor((Date.now() - last) / 86_400_000);
    if (idle >= STALE_DAYS)
      issues.push({
        text: `No update in ${idle} days. Is it still being worked on?`,
        fix: 'Add a short comment on progress, tag it #blocked if it is stuck, or move it back to To do.',
      });
  }
  if (
    item.activatedDate &&
    item.dueDate &&
    Date.parse(item.activatedDate) > Date.parse(item.dueDate)
  ) {
    issues.push({
      text: item.iterationFromParent
        ? 'Started after its parent’s sprint had ended.'
        : 'Started after its sprint had ended.',
      fix: item.iterationFromParent
        ? 'This story has no sprint of its own, so it uses its parent’s. Set this story’s Iteration in Azure DevOps to the sprint it is really in.'
        : 'Set the Iteration field in Azure DevOps to the sprint it is really in.',
    });
  }
  if (!item.assignedTo)
    issues.push({
      text: 'No one is assigned.',
      fix: 'Open the card in Azure DevOps and set Assigned To to the person doing the work.',
    });
  if (!item.description && !item.acceptanceCriteria)
    issues.push({
      text: 'No description.',
      fix: 'Add what the story is for and its acceptance criteria to the card’s Description in Azure DevOps.',
    });
  if (done && !figma)
    issues.push({
      text: 'Done, but no Figma link was shared in the comments.',
      fix: 'Post a comment on the card with the final Figma link, e.g. “#done final files: https://www.figma.com/…”.',
    });
  return issues;
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ActivityEvent {
  key: string;
  at: string;
  icon: LucideIcon;
  tone: 'plain' | 'good' | 'warn';
  who: string | null;
  what: string;
  detail?: string;
}

/** Start, changes made after work began, comments and finish, oldest first. */
function buildActivity(item: WorkItemDetail): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  if (item.activatedDate) {
    events.push({
      key: 'start',
      at: item.activatedDate,
      icon: Play,
      tone: 'plain',
      who: null,
      what: 'Work started',
    });
  }
  for (const c of item.changes) {
    if (!c.afterWorkStarted) continue;
    const from = c.oldValue || 'empty';
    const to = c.newValue || 'empty';
    const blocked = c.field.toLowerCase() === 'blocked';
    events.push({
      key: `c${c.rev}-${c.field}`,
      at: c.changedAt,
      icon: Pencil,
      tone: c.isScopeChange || (blocked && to === 'Yes') ? 'warn' : 'plain',
      who: c.changedBy?.displayName ?? null,
      what: blocked
        ? to === 'Yes'
          ? 'marked it blocked'
          : 'unblocked it'
        : // Long text fields carry no before/after values worth showing.
          !c.oldValue && !c.newValue
          ? `edited the ${c.field.toLowerCase()}`
          : `changed ${c.field.toLowerCase()} from ${from} to ${to}`,
    });
  }
  for (const c of item.comments) {
    const reopen = c.signals.includes('REOPEN') || c.signals.includes('BLOCKED');
    events.push({
      key: `m${c.id}`,
      at: c.createdAt,
      icon: reopen ? RotateCcw : MessageSquare,
      tone: reopen ? 'warn' : 'plain',
      who: c.author?.displayName ?? null,
      what: reopen ? 'flagged a problem' : 'commented',
      detail: c.text,
    });
  }
  if (item.stateCategory === 'Completed' && item.completedDate) {
    events.push({
      key: 'done',
      at: item.completedDate,
      icon: CircleCheck,
      tone: 'good',
      who: null,
      what: 'Marked done',
    });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** "6 days" rather than "6.3d", for readers who don't know the shorthand. */
function plainDays(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return '—';
  // Whole days only; a fraction of a day reads as noise here.
  const n = Math.round(days);
  if (n === 0) return 'under a day';
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function plainHours(hours: number): string {
  if (hours < 1) return 'under an hour';
  if (hours < 48) {
    const n = Math.round(hours);
    return `${n} ${n === 1 ? 'hour' : 'hours'}`;
  }
  return plainDays(hours / 24);
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{children}</dd>
    </div>
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

/** Sections sit on the page with no box: a hairline between them instead. */
function Card({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
  return (
    <BaseCard
      className={clsx(
        'rounded-none! border-x-0! border-t-0! border-b border-line bg-transparent! px-0 py-7 shadow-none! last:border-b-0',
        className,
      )}
      {...props}
    />
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
