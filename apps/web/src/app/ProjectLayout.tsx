import { BOARD_ONLY, SLIM_SECTIONS } from '../lib/features';
import type { PersonRef } from '@ado-metrics/shared';
import { ChartColumn } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useParams } from 'react-router';
import { useProjects, useTeams } from '../api/projects';
import { useWorkItems } from '../api/workItems';
import { AvatarStack } from '../components/ui/Avatar';
import { canViewPeople, useMe } from '../lib/auth';
import { readPref, writePref } from '../lib/prefs';
import { NotFoundPage } from './ErrorPages';
import { DarkPill, PageHeader, type HeaderTab } from './PageHeader';
import { ProjectContext, type ProjectContextValue } from './projectContext';

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  // Re-mount per project so per-project state (team selection) resets cleanly.
  return <ProjectScope key={projectId} projectId={projectId} />;
}

function ProjectScope({ projectId }: { projectId: string }) {
  const me = useMe();
  const project = me.projects.find((p) => p.id === projectId);
  const projects = useProjects();
  const teams = useTeams(projectId);
  const [teamPref, setTeamPref] = useState<string | undefined>(
    () => readPref(`team.${projectId}`) ?? undefined,
  );

  useEffect(() => {
    if (project) writePref('lastProject', projectId);
  }, [project, projectId]);

  // Ignore a remembered team that no longer exists.
  const teamId =
    teamPref && (!teams.data || teams.data.some((t) => t.id === teamPref)) ? teamPref : undefined;

  const value = useMemo<ProjectContextValue | null>(
    () =>
      project
        ? {
            project,
            summary: projects.data?.find((p) => p.id === projectId),
            teams: teams.data ?? [],
            teamsLoading: teams.isPending,
            teamId,
            setTeamId: (id) => {
              setTeamPref(id);
              writePref(`team.${projectId}`, id ?? null);
            },
          }
        : null,
    [project, projects.data, projectId, teams.data, teams.isPending, teamId],
  );

  if (!project || !value) {
    return (
      <NotFoundPage
        title="Project not found"
        description="This project doesn’t exist, hasn’t been synced yet, or you don’t have access to it in Azure DevOps."
      />
    );
  }

  const base = `/projects/${encodeURIComponent(projectId)}`;
  const tabs: HeaderTab[] = [
    { to: `${base}/overview`, label: 'Overview' },
    { to: `${base}/board`, label: 'Board', alsoActive: `${base}/work-items` },
    { to: `${base}/sprints`, label: 'Sprints' },
    { to: `${base}/delays`, label: 'Delays' },
  ];
  if (canViewPeople(me.user)) tabs.push({ to: `${base}/people`, label: 'People' });
  const visibleTabs = BOARD_ONLY ? tabs.filter((t) => SLIM_SECTIONS.includes(t.label)) : tabs;

  return (
    <ProjectContext value={value}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={project.name}
          badge={
            BOARD_ONLY ? undefined : (
              <DarkPill icon={<ChartColumn aria-hidden className="size-3.5" />}>Scrum</DarkPill>
            )
          }
          right={<TeamAvatars projectId={projectId} teamId={teamId} />}
          tabs={visibleTabs}
          tabsLabel={`${project.name} sections`}
        />
        <Outlet />
      </div>
    </ProjectContext>
  );
}

/**
 * There is no team-members endpoint; derive people from assignees of recent work items
 * (same query/cache key as the board's "All items" view, so it costs no extra request there).
 */
function TeamAvatars({ projectId, teamId }: { projectId: string; teamId: string | undefined }) {
  const items = useWorkItems(projectId, { teamId, pageSize: 200 });
  const people = useMemo(() => {
    const seen = new Map<string, PersonRef>();
    for (const wi of items.data?.items ?? []) {
      if (wi.assignedTo && !seen.has(wi.assignedTo.id)) seen.set(wi.assignedTo.id, wi.assignedTo);
    }
    return [...seen.values()];
  }, [items.data]);
  if (people.length === 0) return null;
  return (
    <AvatarStack people={people} max={4} label={`${people.length} people with assigned work`} />
  );
}
