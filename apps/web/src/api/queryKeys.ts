import type { QueryParams } from './client';

/** Central query-key factory so invalidation stays consistent across features. */
export const qk = {
  me: ['me'] as const,
  projects: ['projects'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  teams: (projectId: string) => ['project', projectId, 'teams'] as const,
  health: (projectId: string) => ['project', projectId, 'health'] as const,
  iterations: (projectId: string, teamId?: string) =>
    ['project', projectId, 'iterations', teamId ?? null] as const,
  workItems: (projectId: string, params?: QueryParams) =>
    ['project', projectId, 'work-items', params ?? {}] as const,
  workItemsAll: (projectId: string) => ['project', projectId, 'work-items'] as const,
  workItem: (projectId: string, id: number) => ['project', projectId, 'work-item', id] as const,
  overview: (projectId: string, params: QueryParams) =>
    ['project', projectId, 'metrics', 'overview', params] as const,
  stories: (projectId: string, params: QueryParams) =>
    ['project', projectId, 'metrics', 'stories', params] as const,
  sprints: (projectId: string, teamId?: string) =>
    ['project', projectId, 'metrics', 'sprints', teamId ?? null] as const,
  people: (projectId: string, params: QueryParams) =>
    ['project', projectId, 'people', params] as const,
  delays: (projectId: string, params?: QueryParams) =>
    ['project', projectId, 'delays', params ?? {}] as const,
  delaysAll: (projectId: string) => ['project', projectId, 'delays'] as const,
  delayCategories: ['delay-categories'] as const,
  syncRuns: (params?: QueryParams) => ['admin', 'sync-runs', params ?? {}] as const,
  syncRunsAll: ['admin', 'sync-runs'] as const,
  audit: (params: QueryParams) => ['admin', 'audit', params] as const,
  auditAll: ['admin', 'audit'] as const,
  tasks: (params: QueryParams) => ['tasks', 'list', params] as const,
  taskSummary: (weeks: number) => ['tasks', 'summary', weeks] as const,
  tasksAll: ['tasks'] as const,
  taskComments: (taskId: string) => ['tasks', 'comments', taskId] as const,
};
