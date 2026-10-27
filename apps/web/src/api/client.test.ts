import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiUrl, navigation, safeReturnTo, setCsrfToken } from './client';

function jsonResponse(body: unknown, init: ResponseInit = {}, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': contentType, ...(init.headers ?? {}) },
  });
}

function headersOf(call: unknown[]): Record<string, string> {
  const init = call[1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const assignMock = vi.fn<(url: string) => void>();

  beforeEach(() => {
    fetchMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(navigation, 'assign').mockImplementation(assignMock);
    setCsrfToken(null);
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends same-origin GET with credentials and Accept, without CSRF or Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    setCsrfToken('tok-123');

    await expect(api.get('/projects', { page: 2, search: undefined, teamId: '' })).resolves.toEqual(
      { ok: true },
    );

    const call = fetchMock.mock.calls[0] ?? [];
    expect(call[0]).toBe('/api/projects?page=2');
    expect((call[1] as RequestInit).credentials).toBe('include');
    expect((call[1] as RequestInit).method).toBe('GET');
    const h = headersOf(call);
    expect(h.Accept).toBe('application/json');
    expect(h['X-CSRF-Token']).toBeUndefined();
    expect(h['Content-Type']).toBeUndefined();
  });

  it('adds the CSRF token and JSON content type on POST', async () => {
    setCsrfToken('tok-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'x' }, { status: 201 }));

    await api.post('/admin/sync', { full: true });

    const call = fetchMock.mock.calls[0] ?? [];
    const h = headersOf(call);
    expect(h['X-CSRF-Token']).toBe('tok-123');
    expect(h['Content-Type']).toBe('application/json');
    expect((call[1] as RequestInit).body).toBe('{"full":true}');
  });

  it('fetches the CSRF token from /auth/me when it is not cached yet', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ csrfToken: 'fresh', user: {}, projects: [], authMode: 'dev' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await api.put('/admin/delay-categories/1', { name: 'x' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me');
    expect(headersOf(fetchMock.mock.calls[1] ?? [])['X-CSRF-Token']).toBe('fresh');
  });

  it('maps problem+json errors to a typed ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: 'https://errors/validation',
          title: 'Validation failed',
          status: 422,
          detail: 'Body is invalid',
          traceId: 'trace-abc',
          errors: [{ path: 'comment', message: 'Too short' }, { bogus: true }],
        },
        { status: 422 },
        'application/problem+json',
      ),
    );
    setCsrfToken('t');

    const err = await api.post('/x', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(422);
    expect(e.title).toBe('Validation failed');
    expect(e.detail).toBe('Body is invalid');
    expect(e.traceId).toBe('trace-abc');
    expect(e.errors).toEqual([{ path: 'comment', message: 'Too short' }]);
  });

  it('falls back gracefully for non-JSON errors and reads Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('slow down', {
        status: 429,
        statusText: '',
        headers: { 'Retry-After': '12', 'Content-Type': 'text/plain' },
      }),
    );
    const e = (await api.get('/x').catch((x: unknown) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(429);
    expect(e.title).toBe('Too many requests');
    expect(e.retryAfterSeconds).toBe(12);
  });

  it('wraps network failures as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const e = (await api.get('/x').catch((x: unknown) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(0);
  });

  it('redirects to login with an encoded, same-origin returnTo on 401', async () => {
    window.history.replaceState(null, '', '/projects/abc/board?x=1#top');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { type: 'about:blank', title: 'Unauthorized', status: 401, traceId: 't1' },
        { status: 401 },
        'application/problem+json',
      ),
    );

    const e = (await api.get('/projects').catch((x: unknown) => x)) as ApiError;

    expect(e.status).toBe(401);
    expect(assignMock).toHaveBeenCalledWith(
      `/signin?returnTo=${encodeURIComponent('/projects/abc/board?x=1#top')}`,
    );
  });
});

describe('safeReturnTo', () => {
  it.each([
    ['/projects/1', '/projects/1'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/api/auth/login', '/'],
    ['/a\nb', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});

describe('apiUrl', () => {
  it('drops empty params and encodes values', () => {
    expect(apiUrl('/w', { a: 'x y', b: undefined, c: null, d: '', e: false })).toBe(
      '/api/w?a=x+y&e=false',
    );
  });
});
