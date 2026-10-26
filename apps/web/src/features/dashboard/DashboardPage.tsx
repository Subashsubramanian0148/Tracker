import { PROJECT_HOME } from '../../lib/features';
import { ArrowRight, LayoutDashboard, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { useProjects } from '../../api/projects';
import { PageHeader } from '../../app/PageHeader';
import { NoProjects } from '../../app/RootRedirect';
import { Badge } from '../../components/ui/Badge';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../../lib/auth';
import { formatNumber, formatRelative } from '../../lib/format';
import { useNow } from '../../lib/hooks';

export function DashboardPage() {
  const me = useMe();
  const projects = useProjects();
  const now = useNow();
  const first = me.user.displayName.split(/\s+/)[0] ?? me.user.displayName;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${first}`}
        icon={<LayoutDashboard aria-hidden className="size-7 shrink-0 text-brand-bright" />}
      />
      <section aria-labelledby="projects-title">
        <h2 id="projects-title" className="mb-3 text-lg font-semibold">
          Projects
        </h2>
        {projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
            <span className="sr-only">Loading projects…</span>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : projects.data.length === 0 ? (
          <NoProjects />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${encodeURIComponent(p.id)}/${PROJECT_HOME}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:bg-sidebar"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                    <ArrowRight
                      aria-hidden
                      className="size-5 text-faint transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-sm">
                    <Badge>{formatNumber(p.workItemCount)} items</Badge>
                    {p.openDelayCount > 0 ? (
                      <Badge tone="amber" icon={<TriangleAlert aria-hidden className="size-3" />}>
                        {formatNumber(p.openDelayCount)} open delays
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.lastSyncedAt
                        ? `Synced ${formatRelative(p.lastSyncedAt, now)}`
                        : 'Never synced'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
