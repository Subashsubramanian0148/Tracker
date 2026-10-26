import type { LogoutResponse, MeResponse } from '@ado-metrics/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, navigation, safeReturnTo, setCsrfToken } from './client';
import { qk } from './queryKeys';

export function useMeQuery() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async ({ signal }) => {
      const me = await api.get<MeResponse>('/auth/me', undefined, signal);
      setCsrfToken(me.csrfToken);
      return me;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Where to go after sign-out: the IdP end-session URL (https only) or a same-origin
 * relative path. Anything else (javascript:, http:, protocol-relative) falls back to '/'.
 */
export function safeLogoutTarget(logoutUrl: string | null | undefined): string {
  if (!logoutUrl) return '/';
  if (logoutUrl.startsWith('/')) return safeReturnTo(logoutUrl);
  try {
    const u = new URL(logoutUrl);
    return u.protocol === 'https:' ? u.toString() : '/';
  } catch {
    return '/';
  }
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<LogoutResponse | undefined>('/auth/logout'),
    onSuccess: (res) => {
      setCsrfToken(null);
      // Full navigation drops all cached data (single sign-out via Entra when configured).
      navigation.assign(safeLogoutTarget(res?.logoutUrl));
    },
    onError: () => {
      setCsrfToken(null);
      navigation.assign('/');
    },
  });
}
