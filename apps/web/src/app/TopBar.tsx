import { Download, Menu } from 'lucide-react';
import { useMatch } from 'react-router';
import { useProjects } from '../api/projects';
import { GradientButton, IconButton } from '../components/ui/Button';
import { exportCurrent, useExportSource } from '../lib/exportStore';
import { formatRelative } from '../lib/format';
import { useNow } from '../lib/hooks';
import { TASKS_ENABLED } from '../lib/features';
import { ModeSwitch, useMode } from './ModeSwitch';

/** Small-screen only: opens the sidebar drawer. Wide screens always show the sidebar. */
export function MobileMenuButton({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <IconButton label="Open navigation" onClick={onOpenMenu} className="self-start lg:hidden">
      <Menu aria-hidden className="size-5" />
    </IconButton>
  );
}

/** Live sync status and Export, shown on the right of every page title. Syncing is automatic. */
export function HeaderActions() {
  const projects = useProjects();
  const projectMatch = useMatch('/projects/:projectId/*');
  const summary = projects.data?.find((p) => p.id === projectMatch?.params.projectId);
  const inTasks = useMode() === 'tasks';
  const source = useExportSource();

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {TASKS_ENABLED ? <ModeSwitch /> : null}
      {summary && !inTasks ? <SyncStatus lastSyncedAt={summary.lastSyncedAt} /> : null}
      {inTasks ? null : (
        <GradientButton
          disabled={!source}
          onClick={() => source && exportCurrent(source)}
          icon={<Download aria-hidden className="size-4" />}
          aria-label="Export current table as CSV"
        >
          Export
        </GradientButton>
      )}
    </div>
  );
}

function SyncStatus({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const now = useNow(5_000);
  return (
    <p
      className="hidden items-center gap-1.5 text-[13px] text-muted-foreground sm:flex"
      aria-live="off"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      {lastSyncedAt ? `Synced ${formatRelative(lastSyncedAt, now)}` : 'Not synced yet'}
    </p>
  );
}
