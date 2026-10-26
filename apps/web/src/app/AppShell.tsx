import clsx from 'clsx';
import { useState } from 'react';
import { Outlet, useMatch } from 'react-router';
import { useMeQuery } from '../api/auth';
import { useProjects, useRefreshOnSync } from '../api/projects';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/shadcn/sheet';
import { MeProvider, useMe } from '../lib/auth';
import { readPref, writePref } from '../lib/prefs';
import { Sidebar } from './Sidebar';
import { MobileMenuButton } from './TopBar';

/** Auth gate: loads the session (and CSRF token) before rendering anything else. */
export function AppRoot() {
  const me = useMeQuery();
  if (me.isPending) return <ShellSkeleton />;
  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-[28px] border border-line bg-surface shadow-frame">
          <ErrorState error={me.error} onRetry={() => void me.refetch()} />
        </div>
      </div>
    );
  }
  return (
    <MeProvider value={me.data}>
      <AppShell />
    </MeProvider>
  );
}

function AppShell() {
  const me = useMe();
  const projects = useProjects();
  useRefreshOnSync(projects.data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readPref('sidebar.collapsed') === '1');
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      writePref('sidebar.collapsed', c ? '0' : '1');
      return !c;
    });
  const projectMatch = useMatch('/projects/:projectId/*');
  const activeProjectId = projectMatch?.params.projectId ?? me.projects[0]?.id;

  return (
    <div className="min-h-dvh lg:h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      {/* Full-bleed: the app fills the window edge to edge, with no outer frame. */}
      <div className="flex min-h-dvh bg-surface lg:h-full lg:min-h-0">
        <aside
          aria-label="Sidebar"
          className={clsx(
            // Floating panel: inset from the window edges.
            'hidden shrink-0 py-4 pl-4 transition-[width] lg:block',
            collapsed ? 'w-[88px]' : 'w-[272px]',
          )}
        >
          <Sidebar
            activeProjectId={activeProjectId}
            summaries={projects.data}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </aside>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-[min(300px,85vw)] p-0 lg:hidden">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Pages and projects</SheetDescription>
            <Sidebar
              activeProjectId={activeProjectId}
              summaries={projects.data}
              onNavigate={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:gap-5 lg:p-6">
          <MobileMenuButton onOpenMenu={() => setDrawerOpen(true)} />
          <main
            id="main"
            tabIndex={-1}
            className="relative min-h-0 min-w-0 flex-1 overflow-x-clip outline-none lg:-mr-2 lg:overflow-y-auto lg:pr-2"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh p-0 sm:p-3 lg:h-dvh lg:p-4" role="status" aria-live="polite">
      <span className="sr-only">Loading DesignFlow…</span>
      <div className="flex h-full min-h-dvh gap-5 bg-surface p-5 sm:min-h-0 sm:rounded-[28px] sm:border sm:border-line">
        <Skeleton className="hidden w-60 shrink-0 rounded-[20px] lg:block" />
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
