import type { MeResponse, ProblemDetails } from '@ado-metrics/shared';

export type FieldError = { path: string; message: string };

/** Typed error for any non-2xx response (RFC 9457 problem+json) or network failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly traceId: string | undefined;
  readonly errors: FieldError[];
  readonly retryAfterSeconds: number | undefined;

  constructor(init: {
    status: number;
    title: string;
    detail?: string;
    traceId?: string;
    errors?: FieldError[];
    retryAfterSeconds?: number;
  }) {
    super(init.detail ?? init.title);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.traceId = init.traceId;
    this.errors = init.errors ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The CSRF synchronizer token lives in memory only (never in web storage).
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Builds `/api/<path>?query`, dropping empty values. `path` must start with '/'. */
export function apiUrl(path: string, query?: QueryParams): string {
  const qs = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

/** Encodes a dynamic path segment (ids from the URL are untrusted input). */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

/**
 * Accepts only same-origin relative paths ("/foo"), rejecting protocol-relative
 * ("//evil") and backslash tricks ("/\\evil"), so the login redirect cannot be abused.
 */
export function safeReturnTo(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(path)) return '/';
  if (path.startsWith('/api/')) return '/';
  return path;
}

/** Indirection over full-page navigation (window.location is not mockable in jsdom). */
export const navigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};

export function redirectToLogin(): void {
  const { pathname, search, hash } = window.location;
  const returnTo = safeReturnTo(`${pathname}${search}${hash}`);
  navigation.assign(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseFieldErrors(v: unknown): FieldError[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) =>
    isRecord(e) && typeof e.message === 'string'
      ? [{ path: typeof e.path === 'string' ? e.path : '', message: e.message }]
      : [],
  );
}

async function toApiError(res: Response): Promise<ApiError> {
  const retryHeader = res.headers.get('Retry-After');
  const retryAfterSeconds =
    retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : undefined;
  const fallback = {
    status: res.status,
    title: res.statusText || defaultTitle(res.status),
    traceId: res.headers.get('X-Trace-Id') ?? undefined,
    retryAfterSeconds,
  };
  const type = res.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) return new ApiError(fallback);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return new ApiError(fallback);
  }
  if (!isRecord(body)) return new ApiError(fallback);
  const p = body as Partial<Record<keyof ProblemDetails, unknown>>;
  return new ApiError({
    status: typeof p.status === 'number' ? p.status : res.status,
    title: typeof p.title === 'string' ? p.title : fallback.title,
    detail: typeof p.detail === 'string' ? p.detail : undefined,
    traceId: typeof p.traceId === 'string' ? p.traceId : fallback.traceId,
    errors: parseFieldErrors(p.errors),
    retryAfterSeconds,
  });
}

function defaultTitle(status: number): string {
  if (status === 401) return 'Not signed in';
  if (status === 403) return 'Access denied';
  if (status === 404) return 'Not found';
  if (status === 422) return 'Validation failed';
  if (status === 429) return 'Too many requests';
  if (status >= 500) return 'Server error';
  return 'Request failed';
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= request<MeResponse>('GET', '/auth/me')
    .then((me) => {
      csrfToken = me.csrfToken;
      return me.csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const upper = method.toUpperCase();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (MUTATING.has(upper)) {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path, opts.query), {
      method: upper,
      headers,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'manual',
      signal: opts.signal,
      body: MUTATING.has(upper) && opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError({
      status: 0,
      title: 'Network error',
      detail: 'Could not reach the server. Check your connection and try again.',
    });
  }

  // An API redirect (e.g. to the identity provider) means the session is gone.
  if (res.type === 'opaqueredirect') {
    setCsrfToken(null);
    redirectToLogin();
    throw new ApiError({ status: 401, title: 'Not signed in' });
  }
  if (res.status === 401) {
    setCsrfToken(null);
    redirectToLogin();
    throw await toApiError(res);
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
