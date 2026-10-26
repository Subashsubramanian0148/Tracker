import type { Task, TaskStatus } from '@ado-metrics/shared';
import { ListTodo, Plus } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '../../api/client';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { SectionToolbar } from '../../app/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { KpiTile } from '../../components/ui/KpiTile';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { STATUS_LABEL } from './taskLabels';
import { TaskDialog } from './TaskDialog';
import { TaskBoard } from './TaskBoard';
import { TaskDetailSheet } from './TaskDetailSheet';

const DAY_MS = 86_400_000;
/** Completed work older than this drops off the board so it stays about what is current. */
const RECENT_DAYS = 30;

/** Counts for the tiles, worked out from the person's own tasks. */
export function myTaskStats(tasks: Task[], now: number) {
  const open = tasks.filter((t) => t.status !== 'completed');
  const weekEnd = now + 7 * DAY_MS;
  return {
    open: open.length,
    dueThisWeek: open.filter((t) => t.dueDate && !t.late && Date.parse(t.dueDate) <= weekEnd)
      .length,
    overdue: open.filter((t) => t.late).length,
    waiting: open.filter((t) => t.status === 'approval_pending').length,
    reopened: open.filter((t) => t.status === 'reopened').length,
  };
}

export function MyTasksPage() {
  const [editing, setEditing] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const tasks = useTasks({ scope: 'mine', status: 'all', page: 1, pageSize: 200 });
  const update = useUpdateTask();
  const toast = useToast();

  const openDialog = (task: Task | null) => {
    setEditing(task);
    setDialogOpen(true);
  };

  function setStatus(task: Task, status: TaskStatus) {
    update.mutate(
      { id: task.id, body: { status } },
      {
        onSuccess: () =>
          toast.success(
            status === 'completed' ? 'Nice — task completed' : `Moved to ${STATUS_LABEL[status]}`,
          ),
        onError: (e) =>
          toast.error(
            'Could not update the task',
            isApiError(e) ? (e.detail ?? e.title) : undefined,
          ),
      },
    );
  }

  const all = tasks.data?.items ?? [];
  const items = all.filter(
    (t) =>
      t.status !== 'completed' ||
      (t.completedAt && now - Date.parse(t.completedAt) < RECENT_DAYS * DAY_MS),
  );
  const stats = myTaskStats(all, now);
  const newTask = (
    <Button
      variant="primary"
      icon={<Plus aria-hidden className="size-4" />}
      onClick={() => openDialog(null)}
    >
      New task
    </Button>
  );

  return (
    <div className="space-y-8">
      <section aria-label="My summary">
        <SectionToolbar title="My summary" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile
            label="Open tasks"
            value={tasks.isPending ? '—' : stats.open}
            loading={tasks.isPending}
          />
          <KpiTile
            label="Due this week"
            value={tasks.isPending ? '—' : stats.dueThisWeek}
            hint="Next 7 days"
            loading={tasks.isPending}
          />
          <KpiTile
            label="Overdue"
            value={tasks.isPending ? '—' : stats.overdue}
            hint="Past the due date"
            loading={tasks.isPending}
            tone={stats.overdue ? 'warn' : 'default'}
          />
          <KpiTile
            label="Approval pending"
            value={tasks.isPending ? '—' : stats.waiting}
            hint={stats.reopened ? `${stats.reopened} reopened` : 'Waiting for sign-off'}
            loading={tasks.isPending}
            tone={stats.reopened ? 'warn' : 'default'}
          />
        </div>
      </section>

      <section aria-label="My tasks">
        <SectionToolbar title="My tasks" right={items.length > 0 ? newTask : undefined} />

        {tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : tasks.isPending ? (
          <SkeletonRows rows={5} label="Loading your tasks…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ListTodo aria-hidden className="size-6" />}
            title="Nothing on your list"
            description="Add what you are working on today. Your team sees it in the Team view."
            action={newTask}
          />
        ) : (
          <TaskBoard
            tasks={items}
            showOwner={false}
            canEdit={() => true}
            onStatus={setStatus}
            onOpen={(t) => setOpenId(t.id)}
            busy={update.isPending}
          />
        )}
        {items.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Completed shows the last {RECENT_DAYS} days.
          </p>
        ) : null}
      </section>

      <TaskDetailSheet
        task={all.find((x) => x.id === openId) ?? null}
        editable={true}
        onClose={() => setOpenId(null)}
        onEdit={(task) => {
          setOpenId(null);
          openDialog(task);
        }}
        onStatus={setStatus}
        busy={update.isPending}
      />
      <TaskDialog open={dialogOpen} task={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
