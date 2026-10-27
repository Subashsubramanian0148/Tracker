import type { DelayedItem } from '@ado-metrics/shared';
import { CircleCheck, Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useDelays, type DelayStatus } from '../../api/delays';
import { SectionToolbar } from '../../app/PageHeader';
import { useProject } from '../../app/projectContext';
import { TeamSelect } from '../../app/TeamSelect';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { FieldWrapper, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { canAddDelayReason, useMe } from '../../lib/auth';
import { useRegisterExport } from '../../lib/exportStore';
import { formatShortDate, formatWholeDays, typeShortCode } from '../../lib/format';
import { delayFlagLabel } from '../../lib/labels';

const PAGE_SIZE = 20;

export function DelaysPage() {
  const { project, teamId } = useProject();
  const [status, setStatus] = useState<DelayStatus>('open');
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Reset to the first page whenever the filter set changes (adjusting state during render).
  const currentKey = `${status}|${teamId ?? ''}`;
  const [filterKey, setFilterKey] = useState(currentKey);
  if (filterKey !== currentKey) {
    setFilterKey(currentKey);
    setPage(1);
  }
  const query = useDelays(project.id, { status, teamId, page, pageSize: PAGE_SIZE });

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: `${project.name}-delays.csv`,
            rows: query.data.items.map((d) => ({
              id: d.workItem.id,
              type: d.workItem.type,
              title: d.workItem.title,
              state: d.workItem.state,
              assignee: d.workItem.assignedTo?.displayName ?? '',
              flags: d.flags.map(delayFlagLabel).join('; '),
              detectedAt: d.detectedAt,
              reasonCategory: d.latestReason?.category.name ?? '',
              reasonComment: d.latestReason?.comment ?? '',
            })),
          }
        : null,
    [query.data, project.name],
  );
  useRegisterExport(exportSource);

  return (
    <div>
      <SectionToolbar
        title="Delayed work"
        right={
          <Button
            variant="primary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => setPickerOpen(true)}
          >
            Add delay reason
          </Button>
        }
      >
        <SegmentedControl<DelayStatus>
          label="Delay status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'explained', label: 'Explained' },
            { value: 'all', label: 'All' },
          ]}
        />
        <TeamSelect className="w-44" />
      </SectionToolbar>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <SkeletonRows rows={6} label="Loading delayed items…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<CircleCheck aria-hidden className="size-5" />}
          title={status === 'open' ? 'No unexplained delays' : 'Nothing here'}
          description={
            status === 'open'
              ? 'Every delayed item has a reason. Nice work.'
              : 'No delayed items match this filter.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={query.isFetching || undefined}>
            {query.data.items.map((d) => (
              <li key={d.workItem.id}>
                <DelayRow item={d} projectId={project.id} />
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.total}
            onPageChange={setPage}
            label="Delayed items pages"
          />
        </>
      )}

      <PickWorkItemDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={project.id}
        suggestions={(query.data?.items ?? []).filter((d) => !d.latestReason)}
      />
    </div>
  );
}

function DelayRow({ item, projectId }: { item: DelayedItem; projectId: string }) {
  const me = useMe();
  const wi = item.workItem;
  const href = `/projects/${encodeURIComponent(projectId)}/work-items/${wi.id}`;
  const canAdd = canAddDelayReason(me.user, wi.assignedTo);
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-pill px-2 py-0.5 font-display text-xs font-semibold tabular-nums">
            {typeShortCode(wi.type)} · {wi.id}
          </span>
          {item.flags.map((f) => (
            <Badge key={f} tone="amber" icon={<TriangleAlert aria-hidden className="size-3" />}>
              {delayFlagLabel(f)}
            </Badge>
          ))}
        </div>
        <h3 className="mt-2 font-display text-[15px] font-semibold">
          <Link to={href} className="hover:underline">
            {wi.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={wi.assignedTo?.displayName} seed={wi.assignedTo?.id} size="xs" />
            {wi.assignedTo?.displayName ?? 'Unassigned'}
          </span>
          <span>{wi.state}</span>
          {wi.cycleTimeDays !== null ? (
            <span>Worked {formatWholeDays(wi.cycleTimeDays)}</span>
          ) : null}
          <span>Flagged {formatShortDate(item.detectedAt)}</span>
        </p>
        {item.latestReason ? (
          <div className="mt-3 rounded-xl bg-sidebar px-3 py-2.5 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{item.latestReason.category.name}</Badge>
              <span className="text-xs text-muted-foreground">
                {item.latestReason.createdBy.displayName} ·{' '}
                {formatShortDate(item.latestReason.createdAt)}
              </span>
            </p>
            <p className="mt-1.5 line-clamp-2 break-words whitespace-pre-wrap text-ink-soft">
              {item.latestReason.comment}
            </p>
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        {canAdd ? (
          <ButtonLink
            to={`${href}#delay-reason`}
            variant={item.latestReason ? 'outline' : 'primary'}
            size="sm"
            icon={<Plus aria-hidden className="size-3.5" />}
          >
            {item.latestReason ? 'Update reason' : 'Add reason'}
            <span className="sr-only"> for {wi.title}</span>
          </ButtonLink>
        ) : (
          <ButtonLink to={href} variant="outline" size="sm">
            View<span className="sr-only"> {wi.title}</span>
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

function PickWorkItemDialog({
  open,
  onClose,
  projectId,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  suggestions: DelayedItem[];
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  function go(id: number) {
    onClose();
    setValue('');
    setError(undefined);
    navigate(`/projects/${encodeURIComponent(projectId)}/work-items/${id}#delay-reason`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const m = /^#?(\d{1,10})$/.exec(value.trim());
    const id = m ? Number(m[1]) : NaN;
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
      setError('Enter a work item ID, e.g. 1234.');
      return;
    }
    go(id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a delay reason"
      description="Pick the delayed work item you want to explain."
      size="sm"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FieldWrapper id="pick-wi" label="Work item ID" error={error}>
          <div className="flex gap-2">
            <TextInput
              id="pick-wi"
              data-autofocus
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              invalid={!!error}
              aria-describedby={error ? 'pick-wi-error' : undefined}
              placeholder="1234"
            />
            <Button type="submit" variant="primary">
              Continue
            </Button>
          </div>
        </FieldWrapper>
      </form>
      {suggestions.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Without a reason on this page
          </p>
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {suggestions.slice(0, 10).map((d) => (
              <li key={d.workItem.id}>
                <button
                  type="button"
                  onClick={() => go(d.workItem.id)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-sidebar"
                >
                  <span className="rounded-md bg-pill px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                    {d.workItem.id}
                  </span>
                  <span className="truncate">{d.workItem.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}
