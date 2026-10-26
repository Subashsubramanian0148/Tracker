import type { SyncRun } from '@ado-metrics/shared';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useSyncRuns, useTriggerSync } from '../../api/admin';
import { isApiError } from '../../api/client';
import { SectionToolbar } from '../../app/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { useMe } from '../../lib/auth';
import { durationBetween, formatDateTime, formatNumber } from '../../lib/format';
import { TruncatedText } from '../work-item/TruncatedText';

const PAGE_SIZE = 20;
const ALL = '__all__';

function StatusPill({ status }: { status: SyncRun['status'] }) {
  if (status === 'running')
    return (
      <Badge
        tone="info"
        icon={<RefreshCw aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />}
      >
        Running
      </Badge>
    );
  if (status === 'succeeded') return <Badge tone="success">Succeeded</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

export function SyncTab() {
  const me = useMe();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState(ALL);
  const [confirmFull, setConfirmFull] = useState(false);
  const runs = useSyncRuns(page, PAGE_SIZE);
  const sync = useTriggerSync();
  const toast = useToast();
  const projectName = (id: string | null) =>
    id ? (me.projects.find((p) => p.id === id)?.name ?? id) : 'All projects';

  function trigger(full: boolean) {
    sync.mutate(
      { full, ...(scope === ALL ? {} : { projectId: scope }) },
      {
        onSuccess: () => {
          toast.success(full ? 'Full resync started' : 'Sync started');
          setConfirmFull(false);
          setPage(1);
        },
        onError: (e) =>
          toast.error(
            'Could not start sync',
            isApiError(e)
              ? `${e.detail ?? e.title}${e.traceId ? ` · Trace ${e.traceId}` : ''}`
              : undefined,
          ),
      },
    );
  }

  return (
    <div>
      <SectionToolbar
        title="Sync runs"
        right={
          <>
            <Button
              variant="secondary"
              disabled={sync.isPending}
              onClick={() => setConfirmFull(true)}
              icon={<RotateCcw aria-hidden className="size-4" />}
            >
              Full resync
            </Button>
            <Button
              variant="primary"
              disabled={sync.isPending}
              onClick={() => trigger(false)}
              icon={<RefreshCw aria-hidden className="size-4" />}
            >
              {sync.isPending ? 'Starting…' : 'Run sync'}
            </Button>
          </>
        }
      >
        <Select
          label="Scope"
          hideLabel
          className="w-56"
          value={scope}
          onChange={setScope}
          options={[
            { value: ALL, label: 'All projects' },
            ...me.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </SectionToolbar>

      {runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.isPending ? (
        <SkeletonRows rows={6} label="Loading sync runs…" />
      ) : runs.data.items.length === 0 ? (
        <EmptyState
          title="No sync runs yet"
          description="Start the first sync to pull data from Azure DevOps."
        />
      ) : (
        <>
          <Table caption="Sync runs, newest first">
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th>Trigger</Th>
                <Th>Project</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Revisions</Th>
                <Th>Error</Th>
              </tr>
            </thead>
            <tbody>
              {runs.data.items.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateTime(r.startedAt)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {r.finishedAt ? durationBetween(r.startedAt, r.finishedAt) : '—'}
                  </Td>
                  <Td className="capitalize">{r.trigger}</Td>
                  <Td>{projectName(r.projectId)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(r.itemsUpserted)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(r.revisionsUpserted)}</Td>
                  <Td className="max-w-sm min-w-48 text-danger">
                    {r.error ? (
                      <TruncatedText text={r.error} max={80} />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={runs.data.total}
            onPageChange={setPage}
            label="Sync run pages"
          />
        </>
      )}

      <Modal
        open={confirmFull}
        onClose={() => setConfirmFull(false)}
        size="sm"
        title="Run a full resync?"
        description={`This re-reads every work item and revision for ${scope === ALL ? 'all projects' : projectName(scope)}. It can take a while and uses Azure DevOps API quota.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmFull(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              disabled={sync.isPending}
              onClick={() => trigger(true)}
            >
              {sync.isPending ? 'Starting…' : 'Start full resync'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Incremental syncs keep running on schedule in the meantime.
        </p>
      </Modal>
    </div>
  );
}
