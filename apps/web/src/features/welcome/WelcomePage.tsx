import clsx from 'clsx';
import { Check, Columns3, LayoutDashboard, PlayCircle, Tags, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '../../components/ui/icons';
import { useMe } from '../../lib/auth';
import { readPref, writePref } from '../../lib/prefs';

const GUIDE_URL = 'https://claude.ai/artifact/UcWC98aLdterekUuVeiFd3';
const VIDEO_URL = 'https://claude.ai/artifact/XT8SrN13wnxQfmjncf6Lmk';

interface Step {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  /** In-app route, or an external link opened in a new tab. Neither = just mark it done. */
  to?: string;
  href?: string;
}

function readDone(): string[] {
  try {
    const v: unknown = JSON.parse(readPref('welcomeDone') ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** First-visit page: a short checklist that walks a new user through the app. */
export function WelcomePage() {
  const me = useMe();
  const project = me.projects[0];
  const base = project ? `/projects/${encodeURIComponent(project.id)}` : null;
  const [done, setDone] = useState(readDone);

  const steps: Step[] = [
    {
      key: 'overview',
      icon: LayoutDashboard,
      title: 'Open your project',
      description: 'See delivered, on-time and late stories for your team',
      action: 'Open',
      to: base ? `${base}/overview` : '/dashboard',
    },
    {
      key: 'board',
      icon: Columns3,
      title: 'Check the board',
      description: 'Every story by stage; delayed ones carry a badge',
      action: 'Open',
      to: base ? `${base}/board` : '/dashboard',
    },
    {
      key: 'tags',
      icon: Tags,
      title: 'Tag your comments',
      description: 'In Azure DevOps, start a comment with #blocked, #unblocked, #reopen or #done',
      action: 'Got it',
    },
    {
      key: 'video',
      icon: PlayCircle,
      title: 'Watch the walkthrough',
      description: 'Ten steps in three minutes',
      action: 'Watch',
      href: VIDEO_URL,
    },
  ];

  const finish = (key: string) => {
    if (done.includes(key)) return;
    const next = [...done, key];
    setDone(next);
    writePref('welcomeDone', JSON.stringify(next));
  };
  const current = steps.find((s) => !done.includes(s.key))?.key;
  const firstName = me.user.displayName.split(' ')[0];

  return (
    <div className="relative -mx-4 -mt-4 flex min-h-full flex-col sm:-mx-8 sm:-mt-6">
      {/* Soft hero wash fading into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-soft/50 via-brand-soft/15 to-transparent"
      ></div>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 text-center">
        <LogoMark className="mx-auto size-16 rounded-[18px] shadow-soft" />
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">
          Welcome to DesignFlow{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Let's get you comfortable with the app in four quick steps.
        </p>

        <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-soft">
          <header className="flex items-center justify-between bg-sidebar px-4 py-2.5 text-sm">
            <h2 className="font-medium text-ink">Getting started</h2>
            <span className="text-ink-soft tabular-nums">
              {done.length} / {steps.length} done
            </span>
          </header>
          <ul className="divide-y divide-line">
            {steps.map((s) => {
              const isDone = done.includes(s.key);
              const isCurrent = s.key === current;
              const cls = clsx(
                'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3.5 text-[13px] font-medium transition-colors',
                isCurrent
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'border border-line text-ink-soft hover:bg-sidebar',
              );
              return (
                <li key={s.key} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span
                    className={clsx(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                      isDone
                        ? 'border-transparent bg-brand-soft text-primary'
                        : 'border-line text-ink',
                    )}
                  >
                    {isDone ? (
                      <Check aria-hidden className="size-4" />
                    ) : (
                      <s.icon aria-hidden className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={clsx(
                        'block text-sm font-medium',
                        isDone ? 'text-ink-soft line-through' : 'text-ink',
                      )}
                    >
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  </span>
                  {isDone ? (
                    <span className="text-xs font-medium text-primary">Done</span>
                  ) : s.to ? (
                    <Link to={s.to} onClick={() => finish(s.key)} className={cls}>
                      {s.action}
                    </Link>
                  ) : s.href ? (
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => finish(s.key)}
                      className={cls}
                    >
                      {s.action}
                    </a>
                  ) : (
                    <button type="button" onClick={() => finish(s.key)} className={cls}>
                      {s.action}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="relative pb-6 text-center text-sm text-ink-soft">
        Need help?{' '}
        <a
          href={GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Read the getting-started guide
        </a>
      </p>
    </div>
  );
}
