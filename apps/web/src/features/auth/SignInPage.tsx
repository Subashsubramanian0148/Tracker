import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { safeReturnTo } from '../../api/client';
import { LogoMark } from '../../components/ui/icons';

// CORE brand colours, taken from the logo.
const BRAND_RED = '#BA141A';
const BRAND_NAVY = '#292670';

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

/** Public sign-in page: company accounts only, through Microsoft single sign-on. */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo') ?? '/');
  const signedOut = params.has('signedOut');
  const href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex min-h-dvh bg-muted p-3 sm:p-5">
      <div className="grid w-full flex-1 overflow-hidden rounded-[28px] border border-line bg-surface shadow-frame md:grid-cols-2">
        {/* Brand side */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar p-8 sm:p-16">
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] opacity-[0.07]"
          >
            <circle cx="100" cy="100" r="90" fill="none" stroke={BRAND_RED} strokeWidth="14" />
            <circle cx="100" cy="100" r="52" fill="none" stroke={BRAND_NAVY} strokeWidth="14" />
            <path d="M100 0v200M0 100h200" stroke={BRAND_NAVY} strokeWidth="6" />
          </svg>
          <img src="/core-logo.png?v=2" alt="CORE" className="relative h-10 w-auto self-start" />
          <div className="relative mt-24 md:mt-auto">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-ink">
              <LogoMark className="size-8" />
              DesignFlow
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              See how the design team's work is really moving: what got done, what is late, and why.
              Built on your Azure DevOps boards.
            </p>
          </div>
          <p className="relative mt-10 text-xs text-muted-foreground">
            Internal tool · For CORE staff only
          </p>
        </section>

        {/* Sign-in side */}
        <section className="flex flex-col justify-center border-t border-line p-8 sm:p-12 md:border-t-0 md:border-l">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {signedOut ? 'You are signed out' : 'Sign in'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Use your company Microsoft account. No separate password is needed.
            </p>

            <a
              href={href}
              style={{ backgroundColor: BRAND_RED }}
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl text-sm font-medium text-white shadow-soft transition-opacity hover:opacity-90"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-white">
                <MicrosoftMark />
              </span>
              Sign in with Microsoft
              <ArrowRight aria-hidden className="size-4" />
            </a>

            <p className="mt-6 flex items-start gap-2 rounded-xl bg-sidebar px-4 py-3 text-xs leading-relaxed text-ink-soft">
              <ShieldCheck
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
                style={{ color: BRAND_RED }}
              />
              Only @cspl.com work accounts can sign in. Guest and personal accounts are turned away.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
