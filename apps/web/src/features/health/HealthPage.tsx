import clsx from 'clsx';
import type { ApiHealth, HealthStatus } from '@ado-metrics/shared';
import { Activity, Cloud, Database, RefreshCw, Server, type LucideIcon } from 'lucide-react';
import { useApiHealth } from '../../api/projects';
import { PageHeader } from '../../app/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../../lib/auth';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { readPref } from '../../lib/prefs';

const STATUS: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  ok: { label: 'Healthy', dot: 'bg-success', text: 'text-success' },
  degraded: { label: 'Degraded', dot: 'bg-warn', text: 'text-warn-strong' },
  down: { label: 'Down', dot: 'bg-danger', text: 'text-danger' },
};

function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <span className="relative flex size-2.5">
      {status === 'ok' && (
        <span
          className={clsx(
            'absolute inset-0 animate-ping rounded-full opacity-50',
            STATUS[status].dot,
          )}
        />
      )}
      <span className={clsx('relative size-2.5 rounded-full', STATUS[status].dot)} />
    </span>
  );
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function ms(value: number | null): string {
  if (value === null) return '—';
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function ServiceCard({
  icon: Icon,
  name,
  status,
  value,
  detail,
}: {
  icon: LucideIcon;
  name: string;
  status: HealthStatus;
  value: string;
  detail: string;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
          <span className="flex size-8 items-center justify-center rounded-lg border bg-muted">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
          </span>
          {name}
        </span>
        <span
          className={clsx('flex items-center gap-1.5 text-xs font-medium', STATUS[status].text)}
        >
          <StatusDot status={status} />
          {STATUS[status].label}
        </span>
      </div>
      <div>
        <p className="font-number text-2xl text-ink">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

function overall(h: ApiHealth): HealthStatus {
  const all = [h.api.status, h.database.status, h.azureDevOps.status];
  return all.includes('down') ? 'down' : all.includes('degraded') ? 'degraded' : 'ok';
}

const HEADLINE: Record<HealthStatus, string> = {
  ok: 'All systems are working',
  degraded: 'Working, with some issues',
  down: 'Something is down',
};

/** Live health of the API, database, Azure DevOps connection and sync, refreshed every 10 s. */
export function HealthPage() {
  const me = useMe();
  // Sync and data figures are per project: the one you last opened, else the first you can see.
  const last = readPref('lastProject');
  const project = me.projects.find((p) => p.id === last) ?? me.projects[0];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="API Health" />
      {project ? (
        <HealthBody projectId={project.id} />
      ) : (
        <p className="text-sm text-muted-foreground">No project has been synced yet.</p>
      )}
    </div>
  );
}

function HealthBody({ projectId }: { projectId: string }) {
  const health = useApiHealth(projectId);
  const now = useNow(10_000);

  if (health.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }
  if (health.isError)
    return <ErrorState error={health.error} onRetry={() => void health.refetch()} />;

  const h = health.data.health;
  const status = overall(h);
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <div>
            <p className="font-semibold text-ink">{HEADLINE[status]}</p>
            <p className="text-xs text-muted-foreground">
              Checked {formatRelative(h.checkedAt, now)} · refreshes every 10 seconds
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Round trip from your browser:{' '}
          <span className="font-medium text-ink">{ms(health.data.roundTripMs)}</span>
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceCard
          icon={Server}
          name="API server"
          status={h.api.status}
          value={uptime(h.api.uptimeSeconds)}
          detail="Running without a restart"
        />
        <ServiceCard
          icon={Database}
          name="Database"
          status={h.database.status}
          value={ms(h.database.latencyMs)}
          detail="Time to answer a query"
        />
        <ServiceCard
          icon={Cloud}
          name="Azure DevOps"
          status={h.azureDevOps.status}
          value={formatRelative(h.azureDevOps.lastSuccessAt, now)}
          detail="Last successful read"
        />
        <ServiceCard
          icon={RefreshCw}
          name="Sync"
          status={h.sync.failedLast24h ? 'degraded' : 'ok'}
          value={`${formatNumber(h.sync.runsLast24h)} runs`}
          detail={`Last 24 hours · ${h.sync.failedLast24h} failed · avg ${ms(h.sync.avgDurationMs)}`}
        />
      </div>

      {h.sync.lastError && (
        <Card className="border-danger/30 bg-danger-soft text-sm text-danger">
          <span className="font-medium">Latest sync error:</span> {h.sync.lastError}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent sync runs"
            description="Each run reads what changed in Azure DevOps"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Took</th>
                  <th className="py-2 text-right font-medium">Items</th>
                </tr>
              </thead>
              <tbody>
                {h.recentRuns.map((r) => (
                  <tr key={r.startedAt} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap text-ink">
                      {formatDateTime(r.startedAt)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground capitalize">{r.trigger}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          r.status === 'succeeded' && 'bg-success-soft text-success',
                          r.status === 'failed' && 'bg-danger-soft text-danger',
                          r.status === 'running' && 'bg-accent text-accent-foreground',
                        )}
                      >
                        {r.status === 'succeeded'
                          ? 'Done'
                          : r.status === 'failed'
                            ? 'Failed'
                            : 'Running'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {ms(r.durationMs)}
                    </td>
                    <td className="py-2 text-right text-ink">{formatNumber(r.items)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Stored data" description="Copied from Azure DevOps for this project" />
          <dl className="flex flex-col gap-3">
            {(
              [
                ['Stories and tasks', h.data.workItems],
                ['Change history entries', h.data.revisions],
                ['Comments', h.data.comments],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity aria-hidden className="size-3.5" />
                  {label}
                </dt>
                <dd className="font-number text-ink">{formatNumber(n)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Last synced {formatRelative(h.sync.lastSyncedAt, now)}
          </p>
        </Card>
      </div>
    </div>
  );
}
