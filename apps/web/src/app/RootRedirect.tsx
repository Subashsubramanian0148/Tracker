import { PROJECT_HOME } from '../lib/features';
import { FolderSync } from 'lucide-react';
import { Navigate } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { isAdmin, useMe } from '../lib/auth';
import { readPref } from '../lib/prefs';

export function RootRedirect() {
  const me = useMe();
  const last = readPref('lastProject');
  const target = me.projects.find((p) => p.id === last) ?? me.projects[0];
  if (target)
    return <Navigate to={`/projects/${encodeURIComponent(target.id)}/${PROJECT_HOME}`} replace />;
  return <NoProjects />;
}

export function NoProjects() {
  const me = useMe();
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<FolderSync aria-hidden className="size-5" />}
      title="No projects synced yet"
      description={
        isAdmin(me.user)
          ? 'Run the first sync from the Admin area to pull projects and work items from Azure DevOps.'
          : 'No Azure DevOps projects are available to you yet. Ask an administrator to run a sync.'
      }
      action={
        isAdmin(me.user) ? (
          <ButtonLink to="/admin/sync" variant="primary">
            Go to Admin
          </ButtonLink>
        ) : undefined
      }
    />
  );
}
