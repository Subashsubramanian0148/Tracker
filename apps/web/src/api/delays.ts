import type { DelayCategory, DelayedItem, Paged } from '@ado-metrics/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, seg } from './client';
import { qk } from './queryKeys';

export type DelayStatus = 'open' | 'explained' | 'all';

export function useDelays(
  projectId: string,
  params: { status: DelayStatus; teamId?: string; page: number; pageSize?: number },
) {
  const query = { ...params, pageSize: params.pageSize ?? 20 };
  return useQuery({
    queryKey: qk.delays(projectId, query),
    queryFn: ({ signal }) =>
      api.get<Paged<DelayedItem>>(`/projects/${seg(projectId)}/delays`, query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useDelayCategories() {
  return useQuery({
    queryKey: qk.delayCategories,
    queryFn: ({ signal }) => api.get<DelayCategory[]>('/delay-categories', undefined, signal),
    staleTime: 10 * 60_000,
  });
}
