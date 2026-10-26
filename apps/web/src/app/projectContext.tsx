import type { ProjectRef, ProjectSummary, TeamRef } from '@ado-metrics/shared';
import { createContext, use } from 'react';

export interface ProjectContextValue {
  project: ProjectRef;
  summary: ProjectSummary | undefined;
  teams: TeamRef[];
  teamsLoading: boolean;
  /** Selected team id, or undefined for "All teams". */
  teamId: string | undefined;
  setTeamId: (teamId: string | undefined) => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const ctx = use(ProjectContext);
  if (!ctx) throw new Error('useProject() used outside a project route');
  return ctx;
}
