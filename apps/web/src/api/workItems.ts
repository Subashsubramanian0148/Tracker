import type {
  CreateDelayReasonBody,
  DelayReason,
  Paged,
  WorkItemDetail,
  WorkItemSummary,
} from '@ado-metrics/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, seg } from './client';
import { qk } from './queryKeys';

export interface WorkItemFilters {
  teamId?: string;
  type?: string;
  stateCategory?: string;
  iterationPath?: string;
  delayed?: boolean;
  search?: string;
  sort?: 'changedDate' | 'cycleTime' | 'leadTime' | 'id';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function useWorkItems(projectId: string, filters: WorkItemFilters, enabled = true) {
  const params = {
    teamId: filters.teamId,
    type: filters.type,
    stateCategory: filters.stateCategory,
    iterationPath: filters.iterationPath,
    delayed: filters.delayed === undefined ? undefined : String(filters.delayed),
    search: filters.search,
    sort: filters.sort,
    order: filters.order,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 200,
  };
  return useQuery({
    queryKey: qk.workItems(projectId, params),
    queryFn: ({ signal }) =>
      api.get<Paged<WorkItemSummary>>(`/projects/${seg(projectId)}/work-items`, params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useWorkItem(projectId: string, id: number) {
  return useQuery({
    queryKey: qk.workItem(projectId, id),
    queryFn: ({ signal }) =>
      api.get<WorkItemDetail>(
        `/projects/${seg(projectId)}/work-items/${seg(id)}`,
        undefined,
        signal,
      ),
    enabled: Number.isInteger(id) && id > 0,
  });
}

function useRefreshItem(projectId: string, workItemId: number) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.workItem(projectId, workItemId) }),
      qc.invalidateQueries({ queryKey: qk.delaysAll(projectId) }),
      qc.invalidateQueries({ queryKey: qk.workItemsAll(projectId) }),
      qc.invalidateQueries({ queryKey: qk.projects }),
    ]);
}

/** "Not a signal": a tagged comment stops counting (or counts again). */
export function useIgnoreComment(projectId: string, workItemId: number) {
  const refresh = useRefreshItem(projectId, workItemId);
  return useMutation({
    mutationFn: ({ commentId, ignored }: { commentId: number; ignored: boolean }) => {
      const path = `/projects/${seg(projectId)}/work-items/${seg(workItemId)}/comments/${seg(commentId)}/ignore`;
      return ignored ? api.put<void>(path) : api.delete<void>(path);
    },
    onSuccess: refresh,
  });
}

/** "Not really late": pass a reason to dismiss, or null to undo. */
export function useDismissDelay(projectId: string, workItemId: number) {
  const refresh = useRefreshItem(projectId, workItemId);
  return useMutation({
    mutationFn: (reason: string | null) => {
      const path = `/projects/${seg(projectId)}/work-items/${seg(workItemId)}/dismissal`;
      return reason ? api.put<void>(path, { reason }) : api.delete<void>(path);
    },
    onSuccess: refresh,
  });
}

export function useCreateDelayReason(projectId: string, workItemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDelayReasonBody) =>
      api.post<DelayReason>(
        `/projects/${seg(projectId)}/work-items/${seg(workItemId)}/delay-reasons`,
        body,
      ),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.workItem(projectId, workItemId) }),
        qc.invalidateQueries({ queryKey: qk.delaysAll(projectId) }),
        qc.invalidateQueries({ queryKey: qk.workItemsAll(projectId) }),
        qc.invalidateQueries({ queryKey: qk.projects }),
      ]);
    },
  });
}
