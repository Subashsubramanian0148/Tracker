import {
  ArrowRight,
  CircleCheck,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { safeReturnTo } from '../../api/client';

// Sign-in page accent: one blue, used in tints.
const BLUE = '#2563EB';
const SKY = '#1E9BE6';

/** Microsoft's four-square mark, drawn inline so the page loads nothing from outside. */
function MicrosoftMark() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-[18px]">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/** How DesignFlow gets its data, shown under the showcase. */
const FACTS: { icon: LucideIcon; text: string }[] = [
  { icon: RefreshCw, text: 'Synced from Azure DevOps' },
  { icon: ShieldCheck, text: 'Passed security checks' },
  { icon: Lock, text: 'Read-only, never edits' },
];

const STAGES = ['To do', 'In progress', 'Review', 'Handed over'] as const;
/** Stage colours, like a traffic light: grey, then red, amber and green. */
const STAGE_COLORS = ['#9CA3AF', '#DC2626', '#EAB308', '#16A34A'] as const;

type NoticeKind = 'start' | 'rework' | 'done';
const NOTICE: Record<NoticeKind, { icon: LucideIcon; tone: string; label: string }> = {
  start: { icon: Play, tone: 'bg-[#E6EFFD] text-[#2563EB]', label: 'Started' },
  rework: { icon: RotateCcw, tone: 'bg-[#FFF4E0] text-[#B45309]', label: 'Sent back' },
  done: { icon: CircleCheck, tone: 'bg-[#067647] text-white', label: 'Completed' },
};

interface Frame {
  story: string;
  stage: number;
  notice?: { kind: NoticeKind; text: string };
  /** Totals after this frame. */
  delivered: number;
  onTime: number;
  open: number;
}

const STEP_MS = 2200;
/** How long the line takes to glide between stages. */
const LINE_MS = 1400;
/** Extra frames after a hand-over, so the numbers finish moving before the next story. */
const SETTLE_FRAMES = 2;

/**
 * One story at a time moves along the line; one goes back from Review for rework. Totals change
 * only when a story is handed over.
 */
function buildTimeline(): Frame[] {
  const stories = [
    { title: 'Checkout redesign', rework: false, onTime: 88 },
    { title: 'Onboarding flow', rework: true, onTime: 86 },
    { title: 'Settings page', rework: false, onTime: 87 },
  ];
  const frames: Frame[] = [];
  let totals = { delivered: 24, onTime: 87, open: 6 };
  for (const s of stories) {
    const at = (stage: number, notice?: Frame['notice']) =>
      frames.push({ story: s.title, stage, notice, ...totals });
    at(0, { kind: 'start', text: `${s.title} picked up` });
    at(1);
    at(2);
    if (s.rework) {
      at(1, { kind: 'rework', text: `${s.title} needs changes` });
      at(2);
    }
    totals = { delivered: totals.delivered + 1, onTime: s.onTime, open: totals.open - 1 };
    at(3, { kind: 'done', text: `${s.title} handed over` });
    for (let i = 0; i < SETTLE_FRAMES; i++) at(3);
  }
  return frames;
}
const TIMELINE = buildTimeline();

/** A number that glides slowly to each new value and tints green (better) or red (worse) while it moves. */
function LiveNumber({
  value,
  suffix = '',
  goodWhenUp = true,
}: {
  value: number;
  suffix?: string;
  goodWhenUp?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const [last, setLast] = useState(value);
  const [dir, setDir] = useState(0);
  if (last !== value) {
    setDir(value > last ? 1 : -1);
    setLast(value);
  }
  useEffect(() => {
    const start = performance.now();
    const begin = shown;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1800);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Only re-run when the target changes; `shown` is the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const moving = shown !== value;
  const better = dir > 0 === goodWhenUp;
  const tint = moving ? (better ? 'text-[#067647]' : 'text-[#B42318]') : 'text-ink';
  return (
    <span className={`transition-colors duration-700 ${tint}`}>
      {shown}
      {suffix}
    </span>
  );
}

/** The stage line: the filled part glides to the current stage; the current dot pulses. */
function StageLine({ stage }: { stage: number }) {
  // Dots light up only once the line has reached them, not while it is still moving.
  const [arrived, setArrived] = useState(stage);
  useEffect(() => {
    const id = window.setTimeout(() => setArrived(stage), LINE_MS);
    return () => window.clearTimeout(id);
  }, [stage]);
  const settled = Math.min(stage, arrived);
  const pct = (stage / (STAGES.length - 1)) * 100;
  return (
    <div className="px-2">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#EEF2F8]" />
        <div
          className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition-[clip-path] duration-[1400ms] ease-in-out"
          style={{
            // One gradient across the whole track, revealed up to the current stage.
            backgroundImage: `linear-gradient(90deg, ${STAGE_COLORS.join(', ')})`,
            clipPath: `inset(0 ${100 - pct}% 0 0 round 9999px)`,
          }}
        />
        {STAGES.map((name, i) => {
          const reached = i <= settled;
          const current = i === stage && arrived === stage;
          const color = STAGE_COLORS[i];
          return (
            <span
              key={name}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(i / (STAGES.length - 1)) * 100}%` }}
            >
              {current && (
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-40"
                  style={{ backgroundColor: color }}
                />
              )}
              <span
                className="relative flex size-4 items-center justify-center rounded-full border-2 bg-white transition-colors duration-300"
                style={{ borderColor: reached ? color : '#DCE3EE' }}
              >
                {reached && !current && (
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                )}
                {current && (
                  <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                )}
              </span>
            </span>
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-[9px]">
        {STAGES.map((name, i) => (
          <span
            key={name}
            className={`absolute -translate-x-1/2 whitespace-nowrap transition-colors duration-700 ${
              i === stage && arrived === stage ? 'font-semibold text-ink' : 'text-muted-foreground'
            } ${i === 0 ? 'translate-x-0' : ''} ${i === STAGES.length - 1 ? '-translate-x-full' : ''}`}
            style={{ left: `${(i / (STAGES.length - 1)) * 100}%` }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A small DesignFlow dashboard playing a scripted sprint: one story moves along the line at a time. */
/** Project, team and current sprint from the public showcase endpoint; null until loaded. */
function useShowcase() {
  const [info, setInfo] = useState<{
    project: string | null;
    team: string | null;
    sprint: string | null;
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/showcase', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return info;
}

function DashboardMock() {
  const info = useShowcase();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % TIMELINE.length), STEP_MS);
    return () => window.clearInterval(id);
  }, []);
  const frame = TIMELINE[step]!;
  // The latest notice stays up until the next one replaces it.
  let noticeAt = step;
  while (noticeAt > 0 && !TIMELINE[noticeAt]!.notice) noticeAt--;
  const notice = TIMELINE[noticeAt]!.notice;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-[#E3ECFB] bg-white/90 p-5 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.35)] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#E6EFFD]">
            <img src="/core-mark.png" alt="" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{info?.project ?? 'CORE 2.0'}</p>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
              {[info?.team ?? 'UX Team', info?.sprint].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#E6EFFD] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#2563EB] opacity-60" />
              <span className="relative size-1.5 rounded-full bg-[#2563EB]" />
            </span>
            Live
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-[#EEF2F8] p-4">
          <div className="flex items-center justify-between text-[10px] tracking-wide uppercase">
            <span className="text-muted-foreground">Now moving</span>
            <span className="text-muted-foreground">
              <LiveNumber value={frame.open} goodWhenUp={false} /> open
            </span>
          </div>
          <p
            key={frame.story}
            className="mt-1 mb-4 animate-slide-up text-sm font-semibold text-ink"
          >
            {frame.story}
          </p>
          <StageLine stage={frame.stage} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#EEF2F8] p-3">
            <p className="font-number text-lg">
              <LiveNumber value={frame.delivered} />
            </p>
            <p className="text-[10px] text-muted-foreground">Delivered</p>
          </div>
          <div className="rounded-xl border border-[#EEF2F8] p-3">
            <p className="font-number text-lg">
              <LiveNumber value={frame.onTime} suffix="%" />
            </p>
            <p className="text-[10px] text-muted-foreground">On time</p>
          </div>
        </div>
      </div>

      {notice && <Notice key={noticeAt} kind={notice.kind} text={notice.text} />}
    </div>
  );
}

function Notice({ kind, text }: { kind: NoticeKind; text: string }) {
  const style = NOTICE[kind];
  const Icon = style.icon;
  return (
    <div className="absolute -top-12 -right-8 flex max-w-72 animate-slide-up items-center gap-2.5 rounded-xl border border-[#E3ECFB] bg-white px-3 py-2 shadow-lg">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${style.tone} ${kind === 'rework' ? 'animate-[ring_0.9s_ease-in-out_2]' : ''}`}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[9px] text-muted-foreground">{style.label}</span>
        <span className="block truncate text-xs font-semibold text-ink">{text}</span>
      </span>
    </div>
  );
}

/** Public sign-in page: company accounts only, through Microsoft single sign-on. */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo') ?? '/');
  const signedOut = params.has('signedOut');
  const href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main
      className="flex min-h-dvh"
      style={{ backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #EEF4FE 45%, #4C8DF0 100%)' }}
    >
      <div className="grid w-full flex-1 bg-white md:grid-cols-2">
        {/* Sign-in */}
        <section className="flex flex-col items-center justify-between p-6 sm:p-10">
          <span aria-hidden />

          <div className="my-12 w-full max-w-sm animate-slide-up text-center">
            <img src="/core-logo.png?v=2" alt="CORE" className="mx-auto h-10 w-auto" />
            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
              {signedOut ? 'You are signed out' : 'Log in to DesignFlow'}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Welcome back. Use your company Microsoft account.
            </p>

            <a
              href={href}
              style={{ backgroundColor: BLUE }}
              className="group mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-lg text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)] transition hover:brightness-110"
            >
              <span className="flex size-6 items-center justify-center rounded bg-white">
                <MicrosoftMark />
              </span>
              Continue with Microsoft
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </a>

            <div className="my-6 flex items-center gap-3 text-[11px] text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-[#E3ECFB]" />
              No password needed
              <span className="h-px flex-1 bg-[#E3ECFB]" />
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-[#E3ECFB] bg-[#F5F8FE] px-4 py-3 text-left text-xs leading-relaxed text-ink-soft">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" style={{ color: BLUE }} />
              Only @cspl.com work accounts can sign in. Guest and personal accounts are turned away.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">Internal tool · For CORE staff only</p>
        </section>

        {/* Showcase */}
        <section
          aria-hidden
          className="relative m-3 hidden flex-col items-center justify-center overflow-hidden rounded-[20px] px-12 py-14 md:order-first md:flex"
          style={{
            backgroundImage: 'linear-gradient(160deg, #F4F8FF 0%, #E6EFFD 55%, #D3E3FB 100%)',
          }}
        >
          <h2 className="text-center text-4xl font-bold tracking-tight text-ink">
            See your team’s work
            <span className="block" style={{ color: SKY }}>
              clearly.
            </span>
          </h2>
          <p className="mt-4 max-w-sm text-center text-sm text-muted-foreground">
            What got done, what is late, and why. Built on your Azure DevOps boards.
          </p>
          <div className="mt-16 w-full">
            <DashboardMock />
          </div>
          <ul className="mt-14 flex flex-wrap justify-center gap-2 text-[11px] text-ink-soft">
            {FACTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 backdrop-blur"
              >
                <Icon aria-hidden className="size-3.5" style={{ color: BLUE }} />
                {text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
