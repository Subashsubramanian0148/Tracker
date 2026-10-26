import type {
  OverviewMetrics,
  PersonMetrics,
  SprintHealth,
  StorySummary,
} from '@ado-metrics/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, seg } from './client';
import { qk } from './queryKeys';

export interface MetricsParams {
  teamId?: string;
  from?: string;
  to?: string;
  type?: string;
  [key: string]: string | undefined;
}

export function useOverviewMetrics(projectId: string, params: MetricsParams) {
  return useQuery({
    queryKey: qk.overview(projectId, params),
    queryFn: ({ signal }) =>
      api.get<OverviewMetrics>(`/projects/${seg(projectId)}/metrics/overview`, params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useStorySummary(projectId: string, params: MetricsParams) {
  return useQuery({
    queryKey: qk.stories(projectId, params),
    queryFn: ({ signal }) =>
      api.get<StorySummary>(`/projects/${seg(projectId)}/metrics/stories`, params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSprintHealth(projectId: string, teamId?: string) {
  return useQuery({
    queryKey: qk.sprints(projectId, teamId),
    queryFn: ({ signal }) =>
      api.get<SprintHealth[]>(`/projects/${seg(projectId)}/metrics/sprints`, { teamId }, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePeopleMetrics(projectId: string, params: MetricsParams, enabled: boolean) {
  return useQuery({
    queryKey: qk.people(projectId, params),
    queryFn: ({ signal }) =>
      api.get<PersonMetrics[]>(`/projects/${seg(projectId)}/people`, params, signal),
    placeholderData: keepPreviousData,
    enabled,
    // Individual data: do not keep it around longer than needed.
    gcTime: 60_000,
  });
}
