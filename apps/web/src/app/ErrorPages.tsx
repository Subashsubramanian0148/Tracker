import { Compass, Lock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { isApiError } from '../api/client';
import { ButtonLink } from '../components/ui/Button';

function StatusPage({
  code,
  title,
  description,
  icon,
  children,
}: {
  code: string;
  title: string;
  description: ReactNode;
  icon: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center"
      aria-labelledby="status-title"
    >
      <div className="relative mb-6">
        <div className="gradient-wash flex size-20 items-center justify-center rounded-[26px] opacity-90">
          <div className="flex size-16 items-center justify-center rounded-[22px] bg-surface text-ink">
            {icon}
          </div>
        </div>
      </div>
      <p className="font-display text-sm font-semibold tracking-widest text-muted-foreground">
        {code}
      </p>
      <h2 id="status-title" className="mt-1 text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {children}
      <div className="mt-6 flex gap-2">
        <ButtonLink to="/dashboard" variant="primary">
          Go to dashboard
        </ButtonLink>
      </div>
    </section>
  );
}

export function ForbiddenPage({ description }: { description?: string }) {
  return (
    <StatusPage
      code="403"
      title="You don’t have access"
      description={
        description ??
        'Your role doesn’t include this page. Ask an administrator if you think this is a mistake.'
      }
      icon={<Lock aria-hidden className="size-7" />}
    />
  );
}

export function NotFoundPage({ title, description }: { title?: string; description?: string }) {
  return (
    <StatusPage
      code="404"
      title={title ?? 'Page not found'}
      description={description ?? 'The page you’re looking for doesn’t exist or has moved.'}
      icon={<Compass aria-hidden className="size-7" />}
    />
  );
}

/** Route errorElement: render errors thrown while rendering/loading a route. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (isApiError(error) && error.status === 403) return <ForbiddenPage />;
  if (isApiError(error) && error.status === 404) return <NotFoundPage />;
  const traceId = isApiError(error) ? error.traceId : undefined;
  return (
    <StatusPage
      code="ERROR"
      title="Something went wrong"
      description="An unexpected error occurred while showing this page. Try reloading; if it keeps happening, contact support."
      icon={<TriangleAlert aria-hidden className="size-7" />}
    >
      {traceId ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Trace ID:{' '}
          <code className="rounded bg-pill px-1.5 py-0.5 font-mono select-all">{traceId}</code>
        </p>
      ) : null}
    </StatusPage>
  );
}
