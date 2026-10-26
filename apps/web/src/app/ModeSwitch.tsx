import clsx from 'clsx';
import { BarChart3, ListTodo } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';

export type AppMode = 'tasks' | 'metrics';

export const modeOf = (pathname: string): AppMode =>
  pathname.startsWith('/tasks') ? 'tasks' : 'metrics';

// Last page seen in each mode, so switching back lands where you left off.
const lastPath: Record<AppMode, string> = { tasks: '/tasks', metrics: '/dashboard' };

export function useMode(): AppMode {
  const { pathname, search } = useLocation();
  const mode = modeOf(pathname);
  useEffect(() => {
    lastPath[mode] = pathname + search;
  }, [mode, pathname, search]);
  return mode;
}

const MODES: { mode: AppMode; label: string; icon: typeof ListTodo }[] = [
  { mode: 'tasks', label: 'Tasks', icon: ListTodo },
  { mode: 'metrics', label: 'Azure metrics', icon: BarChart3 },
];

export function ModeSwitch({ className }: { className?: string }) {
  const current = useMode();
  return (
    <nav aria-label="Mode" className={clsx('inline-flex rounded-full bg-pill p-1', className)}>
      {MODES.map(({ mode, label, icon: Icon }) => (
        <Link
          key={mode}
          to={mode === current ? '#' : lastPath[mode]}
          aria-current={mode === current ? 'page' : undefined}
          onClick={(e) => mode === current && e.preventDefault()}
          className={clsx(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-4 font-display text-[13px] font-medium transition-colors',
            mode === current
              ? 'bg-surface text-ink shadow-soft'
              : 'text-muted-foreground hover:text-ink',
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
