import { BOARD_ONLY, SLIM_SECTIONS } from '../lib/features';
import type { ProjectRef, ProjectSummary } from '@ado-metrics/shared';
import clsx from 'clsx';
import {
  ChevronRight,
  Folder,
  LayoutGrid,
  Activity,
  Rocket,
  ListTodo,
  LogOut,
  ChevronDown,
  PanelLeft,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useLogout } from '../api/auth';
import { IconButton } from '../components/ui/Button';
import { Popover } from '../components/ui/Popover';
import { Hint } from '../components/ui/Tooltip';
import { LogoMark } from '../components/ui/icons';
import { Avatar } from '../components/ui/Avatar';
import { canViewPeople, isAdmin, useMe } from '../lib/auth';
import { formatCompact } from '../lib/format';
import { useMode } from './ModeSwitch';

interface SidebarProps {
  activeProjectId: string | undefined;
  summaries: ProjectSummary[] | undefined;
  onNavigate?: () => void;
  /** Wide screens only: icons-only rail. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const ITEM =
  'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors';
// Active page lifts off the tinted panel as a white tile.
const ITEM_ACTIVE = 'bg-surface font-medium text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]';
const ITEM_IDLE = 'text-ink-soft hover:bg-surface/60 hover:text-ink';
const ICON = 'size-[18px] shrink-0';

export function Sidebar({
  activeProjectId,
  summaries,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const me = useMe();
  const navigate = useNavigate();
  const mode = useMode();
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const [projectsOpen, setProjectsOpen] = useState(true);
  // Explicit open/closed choices; projects without a choice follow "is active".
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    const pid = activeProjectId ?? me.projects[0]?.id;
    if (!q || !pid) return;
    const asId = /^#?(\d{1,10})$/.exec(q);
    // Search text travels in router state, not the URL.
    if (asId) navigate(`/projects/${encodeURIComponent(pid)}/work-items/${asId[1]}`);
    else navigate(`/projects/${encodeURIComponent(pid)}/board`, { state: { search: q } });
    setSearch('');
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-sidebar">
      <div
        className={clsx(
          'flex h-16 shrink-0 items-center gap-2.5',
          collapsed ? 'justify-center' : 'pr-3 pl-5',
        )}
      >
        {collapsed ? null : (
          <>
            <LogoMark className="size-7" />
            <span className="flex-1 font-display text-base font-bold tracking-tight">
              DesignFlow
            </span>
          </>
        )}
        {onToggleCollapsed ? (
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapsed}
            className="size-8 text-muted-foreground"
          >
            <PanelLeft aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </IconButton>
        ) : null}
      </div>

      <nav
        aria-label="Main"
        className={clsx('min-h-0 flex-1 overflow-y-auto pb-3', collapsed ? 'px-3' : 'px-3')}
      >
        <ul className="space-y-0.5">
          {mode === 'metrics' && !collapsed ? (
            <li>
              <form role="search" onSubmit={onSearch}>
                <label
                  className={clsx(
                    ITEM,
                    'mb-3 cursor-text bg-surface/70 text-muted-foreground focus-within:bg-surface focus-within:ring-1 focus-within:ring-line-strong',
                  )}
                >
                  <Search aria-hidden className={ICON} strokeWidth={1.75} />
                  <span className="sr-only">Search work items by id or title</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    maxLength={200}
                    placeholder="Search"
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </form>
            </li>
          ) : null}

          {mode === 'tasks' ? (
            <>
              <SideLink
                to="/tasks/mine"
                icon={ListTodo}
                collapsed={collapsed}
                onNavigate={onNavigate}
              >
                My tasks
              </SideLink>
              <SideLink to="/tasks/team" icon={Users} collapsed={collapsed} onNavigate={onNavigate}>
                Team
              </SideLink>
            </>
          ) : (
            <>
              <SideLink to="/welcome" icon={Rocket} collapsed={collapsed} onNavigate={onNavigate}>
                Get started
              </SideLink>
              <SideLink
                to="/dashboard"
                icon={LayoutGrid}
                collapsed={collapsed}
                onNavigate={onNavigate}
              >
                Dashboard
              </SideLink>
              <SideLink to="/health" icon={Activity} collapsed={collapsed} onNavigate={onNavigate}>
                API Health
              </SideLink>
            </>
          )}

          {mode === 'metrics' ? (
            collapsed ? (
              // One entry for all projects; it opens the current project.
              activeProjectId ? (
                <SideLink
                  to={`/projects/${encodeURIComponent(activeProjectId)}/overview`}
                  icon={Folder}
                  collapsed
                  active={pathname.startsWith('/projects/')}
                  onNavigate={onNavigate}
                >
                  Projects
                </SideLink>
              ) : null
            ) : (
              <li className="pt-4">
                {/* Section label that folds the project list. */}
                <button
                  type="button"
                  onClick={() => setProjectsOpen((o) => !o)}
                  aria-expanded={projectsOpen}
                  className="mb-1 flex w-full items-center justify-between px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-ink"
                >
                  Projects
                  <ChevronRight
                    aria-hidden
                    className={clsx('size-3.5 transition-transform', projectsOpen && 'rotate-90')}
                  />
                </button>
                {projectsOpen ? (
                  <ul className="space-y-0.5">
                    {me.projects.map((p) => {
                      const isActive = p.id === activeProjectId;
                      const open = expanded[p.id] ?? isActive;
                      return (
                        <ProjectGroup
                          key={p.id}
                          project={p}
                          active={isActive}
                          summary={summaries?.find((s) => s.id === p.id)}
                          open={open}
                          onToggle={() => setExpanded((x) => ({ ...x, [p.id]: !open }))}
                          showPeople={canViewPeople(me.user)}
                          onNavigate={onNavigate}
                        />
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            )
          ) : null}
        </ul>
      </nav>

      {/* Secondary links sit at the bottom, above the account row. */}
      {isAdmin(me.user) ? (
        <ul className="shrink-0 px-3 pb-1">
          <SideLink to="/admin" icon={Settings} collapsed={collapsed} onNavigate={onNavigate}>
            Admin
          </SideLink>
        </ul>
      ) : null}

      <UserRow collapsed={collapsed} />
    </div>
  );
}

function SideLink({
  to,
  icon: Icon,
  children,
  collapsed,
  active,
  onNavigate,
}: {
  to: string;
  icon: LucideIcon;
  children: string;
  collapsed: boolean;
  /** Overrides route matching (e.g. a project icon is active on any of its pages). */
  active?: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-label={collapsed ? children : undefined}
      className={({ isActive }) =>
        clsx(
          ITEM,
          collapsed && 'justify-center px-0',
          (active ?? isActive) ? ITEM_ACTIVE : ITEM_IDLE,
        )
      }
    >
      <Icon aria-hidden className={ICON} strokeWidth={1.75} />
      {collapsed ? null : children}
    </NavLink>
  );
  return (
    <li>
      {collapsed ? (
        <Hint content={children} side="right">
          {/* Own trigger element: the tooltip's Slot would drop NavLink's className function. */}
          <span className="block">{link}</span>
        </Hint>
      ) : (
        link
      )}
    </li>
  );
}

function ProjectGroup({
  project,
  active,
  summary,
  open,
  onToggle,
  showPeople,
  onNavigate,
}: {
  project: ProjectRef;
  active: boolean;
  summary: ProjectSummary | undefined;
  open: boolean;
  onToggle: () => void;
  showPeople: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const base = `/projects/${encodeURIComponent(project.id)}`;
  const listId = `proj-nav-${project.id}`;
  const children: {
    to: string;
    label: string;
    count?: string;
    countLabel?: string;
    alsoActive?: string;
  }[] = [
    { to: `${base}/overview`, label: 'Overview' },
    {
      to: `${base}/board`,
      label: 'Board',
      alsoActive: `${base}/work-items`,
      count: summary?.workItemCount ? formatCompact(summary.workItemCount) : undefined,
      countLabel: `${summary?.workItemCount ?? 0} work items`,
    },
    { to: `${base}/sprints`, label: 'Sprints' },
    {
      to: `${base}/delays`,
      label: 'Delays',
      count: summary?.openDelayCount ? formatCompact(summary.openDelayCount) : undefined,
      countLabel: `${summary?.openDelayCount ?? 0} open delays`,
    },
  ];
  if (showPeople) children.push({ to: `${base}/people`, label: 'People' });
  const visible = BOARD_ONLY ? children.filter((c) => SLIM_SECTIONS.includes(c.label)) : children;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={clsx(ITEM, ITEM_IDLE, active && 'font-medium text-ink')}
      >
        <Folder aria-hidden className={ICON} strokeWidth={1.75} />
        <span className="flex-1 truncate">{project.name}</span>
        <ChevronDown
          aria-hidden
          className={clsx(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>
      {open ? (
        // Pages hang off a thin guide line under the folder icon.
        <ul
          id={listId}
          className="mt-0.5 mb-1 ml-[21px] space-y-0.5 border-l border-line-strong pl-2.5"
        >
          {visible.map((c) => (
            <li key={c.to}>
              <NavLink
                to={c.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex h-9 items-center justify-between gap-2 rounded-lg px-3 text-sm transition-colors',
                    isActive || (c.alsoActive && pathname.startsWith(c.alsoActive))
                      ? ITEM_ACTIVE
                      : ITEM_IDLE,
                  )
                }
              >
                {c.label}
                {c.count ? (
                  <span
                    className="text-xs text-muted-foreground tabular-nums"
                    aria-label={c.countLabel}
                  >
                    {c.count}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function UserRow({ collapsed }: { collapsed: boolean }) {
  const { user } = useMe();
  const logout = useLogout();
  const menu = (trigger: (props: Record<string, unknown>) => ReactNode) => (
    <Popover label="Account" role="menu" align="start" trigger={trigger}>
      {() => (
        <>
          <p className="truncate px-3 py-2 text-xs text-muted-foreground">
            {user.jobTitle ?? user.email}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </>
      )}
    </Popover>
  );

  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center p-3">
        {menu((props) => (
          <button
            type="button"
            {...props}
            aria-label={`${user.displayName}, account menu`}
            className="rounded-full"
          >
            <Avatar name={user.displayName} seed={user.id} size="md" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="shrink-0 px-3 pt-2 pb-4">
      {menu((props) => (
        <button
          type="button"
          {...props}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface/60"
        >
          <Avatar name={user.displayName} seed={user.id} size="md" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
            {user.displayName}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
