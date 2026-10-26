import clsx from 'clsx';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { DiamondMark } from '../components/ui/icons';
import { HeaderActions } from './TopBar';

export interface HeaderTab {
  to: string;
  label: string;
  end?: boolean;
}

interface PageHeaderProps {
  title: string;
  badge?: ReactNode;
  right?: ReactNode;
  tabs?: HeaderTab[];
  tabsLabel?: string;
  icon?: ReactNode;
}

/** Optional icon + big title + dark pill, with diamond tab links under an L-connector. */
export function PageHeader({
  title,
  badge,
  right,
  tabs,
  tabsLabel = 'Sections',
  icon,
}: PageHeaderProps) {
  return (
    <header className="border-b border-line pb-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <h1 className="truncate text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">
            {title}
          </h1>
          {badge}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {right}
          <HeaderActions />
        </div>
      </div>
      {tabs && tabs.length > 0 ? (
        <div className="relative mt-2 flex">
          {/* L-shaped connector from the title icon to the tab row. */}
          {icon ? (
            <span
              aria-hidden
              className="mt-0 ml-[13px] h-5 w-4 shrink-0 rounded-bl-lg border-b border-l border-line-strong"
            />
          ) : null}
          <nav aria-label={tabsLabel} className="relative -mb-px min-w-0 overflow-x-auto">
            <ul className={clsx('flex gap-1 pt-2', icon ? 'pl-1' : '-ml-3')}>
              {tabs.map((t) => (
                <li key={t.to}>
                  <NavLink
                    to={t.to}
                    end={t.end}
                    className={({ isActive }) =>
                      clsx(
                        'inline-flex items-center gap-1.5 border-b-2 px-3 pt-1 pb-3 font-display text-sm font-medium whitespace-nowrap transition-colors',
                        isActive
                          ? 'border-ink text-ink'
                          : 'border-transparent text-muted-foreground hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <DiamondMark
                          filled={isActive}
                          className={isActive ? 'text-ink' : 'text-faint'}
                        />
                        {t.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : (
        <div className="h-5" />
      )}
    </header>
  );
}

export function DarkPill({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="dark-sheen inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-display text-xs font-medium text-white shadow-soft ring-1 ring-white/10 ring-inset">
      {icon}
      {children}
    </span>
  );
}

/** Section title + filter row used at the top of each page body. */
export function SectionToolbar({
  title,
  children,
  right,
}: {
  title: string;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {right ? <div className="ml-auto flex flex-wrap items-center gap-3">{right}</div> : null}
      </div>
    </div>
  );
}
