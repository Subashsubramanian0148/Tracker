import clsx from 'clsx';
import { CircleAlert, Lock, RefreshCw } from 'lucide-react';
import { isApiError } from '../../api/client';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Friendly error with the server trace id so support can correlate with logs. */
export function ErrorState({ error, title, onRetry, className, compact }: ErrorStateProps) {
  const api = isApiError(error) ? error : null;
  const status = api?.status;
  const heading =
    title ??
    (status === 401
      ? 'Redirecting to sign in…'
      : status === 403
        ? 'You don’t have access to this'
        : status === 404
          ? 'Not found'
          : status === 429
            ? 'Too many requests'
            : status === 0
              ? 'Can’t reach the server'
              : 'Something went wrong');
  const detail =
    status === 429 && api?.retryAfterSeconds
      ? `Please wait ${api.retryAfterSeconds}s and try again.`
      : (api?.detail ?? (api ? api.title : 'An unexpected error occurred.'));
  const Icon = status === 403 ? Lock : CircleAlert;

  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-ink">{heading}</h3>
      {status !== 401 ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {api?.traceId ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Trace ID:{' '}
          <code className="rounded bg-pill px-1.5 py-0.5 font-mono text-ink-soft select-all">
            {api.traceId}
          </code>
        </p>
      ) : null}
      {onRetry && status !== 401 && status !== 403 ? (
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
          onClick={onRetry}
          icon={<RefreshCw aria-hidden className="size-3.5" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
