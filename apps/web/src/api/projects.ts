import type { Iteration, ProjectSummary, TeamRef } from '@ado-metrics/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api, seg } from './client';
import { qk } from './queryKeys';

export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: ({ signal }) => api.get<ProjectSummary[]>('/projects', undefined, signal),
    // The server syncs every 10 s; polling as often keeps "Synced …" and the data close behind it.
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useTeams(projectId: string) {
  return useQuery({
    queryKey: qk.teams(projectId),
    queryFn: ({ signal }) =>
      api.get<TeamRef[]>(`/projects/${seg(projectId)}/teams`, undefined, signal),
    staleTime: 10 * 60_000,
  });
}

export function useIterations(projectId: string, teamId?: string, enabled = true) {
  return useQuery({
    queryKey: qk.iterations(projectId, teamId),
    queryFn: ({ signal }) =>
      api.get<Iteration[]>(`/projects/${seg(projectId)}/iterations`, { teamId }, signal),
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** When any project finishes a new sync, refetch everything else so pages show the fresh data. */
export function useRefreshOnSync(projects: ProjectSummary[] | undefined) {
  const qc = useQueryClient();
  const latest = projects?.reduce<string>(
    (m, p) => (p.lastSyncedAt && p.lastSyncedAt > m ? p.lastSyncedAt : m),
    '',
  );
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (latest === undefined) return;
    if (seen.current !== undefined && latest !== seen.current) {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== qk.projects[0] });
    }
    seen.current = latest;
  }, [latest, qc]);
}
