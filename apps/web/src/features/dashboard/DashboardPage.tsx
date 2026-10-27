import { PROJECT_HOME } from '../../lib/features';
import type { ProjectSummary } from '@ado-metrics/shared';
import clsx from 'clsx';
import {
  ArrowRight,
  CircleCheck,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  Layers,
  Rocket,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { useProjects } from '../../api/projects';
import { NoProjects } from '../../app/RootRedirect';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../../lib/auth';
import { formatNumber, formatRelative } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { readPref } from '../../lib/prefs';

const WELCOME_STEPS = 4;

function welcomeLeft(): number {
  try {
    const v: unknown = JSON.parse(readPref('welcomeDone') ?? '[]');
    return Math.max(0, WELCOME_STEPS - (Array.isArray(v) ? v.length : 0));
  } catch {
    return WELCOME_STEPS;
  }
}

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const me = useMe();
  const projects = useProjects();
  const now = useNow();
  const first = me.user.displayName.split(/\s+/)[0] ?? me.user.displayName;
  const left = welcomeLeft();
  const list = projects.data ?? [];
  const items = list.reduce((n, p) => n + p.workItemCount, 0);
  const delays = list.reduce((n, p) => n + p.openDelayCount, 0);
  const today = new Date(now).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="relative -mx-4 -mt-4 flex min-h-full flex-col sm:-mx-8 sm:-mt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-soft/50 via-brand-soft/15 to-transparent"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-4 py-10 sm:px-8">
        <header>
          <p className="text-sm text-ink-soft">{today}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[34px]">
            {greeting(now)}, {first}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">Here's where your teams stand right now.</p>
        </header>

        {projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.isPending ? (
          <div className="grid gap-4 sm:grid-cols-3" role="status">
            <span className="sr-only">Loading projects…</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : list.length === 0 ? (
          <NoProjects />
        ) : (
          <>
            <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
              <Total icon={FolderKanban} label="Projects" value={list.length} />
              <Total icon={Layers} label="Stories tracked" value={items} />
              <Total
                icon={TriangleAlert}
                label="Late right now"
                value={delays}
                alert={delays > 0}
              />
            </section>

            {left > 0 ? (
              <Link
                to="/welcome"
                className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft transition-colors hover:bg-sidebar"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Rocket aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">Finish getting started</span>
                  <span className="block text-xs text-muted-foreground">
                    {left} of {WELCOME_STEPS} steps left
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 text-faint transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : null}

            <section aria-labelledby="projects-title">
              <h2 id="projects-title" className="mb-3 text-lg font-semibold">
                Your projects
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <ProjectCard project={p} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Total({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span
        className={clsx(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          alert ? 'bg-brand-soft text-primary' : 'bg-sidebar text-ink-soft',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span
          className={clsx(
            'block font-display text-2xl font-semibold tabular-nums',
            alert ? 'text-primary' : 'text-ink',
          )}
        >
          {formatNumber(value)}
        </span>
      </span>
    </div>
  );
}

function ProjectCard({ project: p, now }: { project: ProjectSummary; now: number }) {
  const base = `/projects/${encodeURIComponent(p.id)}`;
  const share = p.workItemCount > 0 ? p.openDelayCount / p.workItemCount : 0;
  const healthy = p.openDelayCount === 0;
  const initials = p.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-soft">
      <Link
        to={`${base}/${PROJECT_HOME}`}
        className="group flex flex-1 flex-col gap-4 rounded-t-2xl p-5 transition-colors hover:bg-sidebar/60"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft font-display text-sm font-semibold text-primary">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{p.name}</h3>
            <p className="text-xs text-muted-foreground">
              {p.lastSyncedAt ? `Synced ${formatRelative(p.lastSyncedAt, now)}` : 'Never synced'}
            </p>
          </div>
          <span
            className={clsx(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-soft text-amber-ink',
            )}
          >
            {healthy ? (
              <CircleCheck aria-hidden className="size-3.5" />
            ) : (
              <TriangleAlert aria-hidden className="size-3.5" />
            )}
            {healthy ? 'On track' : 'Needs a look'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Stories</p>
            <p className="font-display text-xl font-semibold tabular-nums">
              {formatNumber(p.workItemCount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Late right now</p>
            <p
              className={clsx(
                'font-display text-xl font-semibold tabular-nums',
                healthy ? 'text-ink' : 'text-primary',
              )}
            >
              {formatNumber(p.openDelayCount)}
            </p>
          </div>
        </div>

        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sidebar">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {Math.round(share * 100)}% of stories are late
          </p>
        </div>
      </Link>

      <div className="flex border-t border-line text-sm">
        <Link
          to={`${base}/overview`}
          className="flex flex-1 items-center justify-center gap-2 rounded-bl-2xl py-3 text-ink-soft transition-colors hover:bg-sidebar hover:text-ink"
        >
          <LayoutDashboard aria-hidden className="size-4" />
          Overview
        </Link>
        <Link
          to={`${base}/board`}
          className="flex flex-1 items-center justify-center gap-2 rounded-br-2xl border-l border-line py-3 text-ink-soft transition-colors hover:bg-sidebar hover:text-ink"
        >
          <Columns3 aria-hidden className="size-4" />
          Board
        </Link>
      </div>
    </article>
  );
}
