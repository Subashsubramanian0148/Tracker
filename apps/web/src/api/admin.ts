import type {
  AuditEntry,
  DelayCategory,
  Paged,
  SyncRun,
  TriggerSyncBody,
  UpsertDelayCategoryBody,
} from '@ado-metrics/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, seg } from './client';
import { qk } from './queryKeys';

export function useSyncRuns(page: number, pageSize = 20) {
  const params = { page, pageSize };
  return useQuery({
    queryKey: qk.syncRuns(params),
    queryFn: ({ signal }) => api.get<Paged<SyncRun>>('/admin/sync-runs', params, signal),
    placeholderData: keepPreviousData,
    // Poll while a run is in progress so the status pill updates on its own.
    refetchInterval: (q) =>
      q.state.data?.items.some((r) => r.status === 'running') ? 5_000 : false,
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<TriggerSyncBody>) => api.post<SyncRun>('/admin/sync', body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.syncRunsAll }),
        qc.invalidateQueries({ queryKey: qk.projects }),
      ]);
    },
  });
}

export function useUpsertDelayCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertDelayCategoryBody }) =>
      id
        ? api.put<DelayCategory>(`/admin/delay-categories/${seg(id)}`, body)
        : api.post<DelayCategory>('/admin/delay-categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.delayCategories }),
  });
}

export interface AuditParams {
  page: number;
  pageSize: number;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  [key: string]: string | number | undefined;
}

export function useAuditLog(params: AuditParams) {
  return useQuery({
    queryKey: qk.audit(params),
    queryFn: ({ signal }) => api.get<Paged<AuditEntry>>('/admin/audit-logs', params, signal),
    placeholderData: keepPreviousData,
  });
}

export interface AuditVerifyResult {
  intact: boolean;
  firstBrokenId: string | null;
}

/** Recomputes the hash chain on demand. A mutation, not a query: each run writes an `audit.verify` entry. */
export function useVerifyAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.get<AuditVerifyResult>('/admin/audit-logs/verify'),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.auditAll }),
  });
}
