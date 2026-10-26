import type { Task, TaskStatus } from '@ado-metrics/shared';
import clsx from 'clsx';
import { CalendarDays, Clock } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';
import { formatHours, formatShortDate } from '../../lib/format';
import { STATUS_LABEL, STATUS_OPTIONS } from './taskLabels';

/** Board columns follow the design workflow left to right; Reopened sits last so it stands out. */
export const BOARD_COLUMNS: TaskStatus[] = [
  'upcoming',
  'started',
  'in_progress',
  'approval_pending',
  'completed',
  'reopened',
];

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  upcoming: 'bg-muted-foreground/40',
  started: 'bg-sky-500',
  in_progress: 'bg-primary',
  approval_pending: 'bg-amber-500',
  completed: 'bg-success',
  reopened: 'bg-danger',
};

interface TaskBoardProps {
  tasks: Task[];
  /** Off on My tasks, where every card is yours. */
  showOwner?: boolean;
  canEdit: (task: Task) => boolean;
  onStatus: (task: Task, status: TaskStatus) => void;
  /** Opens the task's detail panel (description and comments). */
  onOpen: (task: Task) => void;
  busy?: boolean;
}

/** Every status at a glance: one column per status, no filters needed. */
export function TaskBoard({
  tasks,
  showOwner = true,
  canEdit,
  onStatus,
  onOpen,
  busy,
}: TaskBoardProps) {
  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] grid-cols-6 gap-3 px-1">
        {BOARD_COLUMNS.map((status) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`col-${status}`}
              className="flex min-h-40 flex-col rounded-2xl bg-pill p-2.5"
            >
              <h4
                id={`col-${status}`}
                className="mb-2.5 flex items-center gap-2 px-1 font-display text-[13px] font-semibold text-ink"
              >
                <span aria-hidden className={clsx('size-2 rounded-full', COLUMN_ACCENT[status])} />
                {STATUS_LABEL[status]}
                <span className="ml-auto rounded-full bg-surface px-2 text-xs font-medium text-muted-foreground tabular-nums">
                  {column.length}
                </span>
              </h4>
              {column.length === 0 ? (
                <p className="px-1 py-3 text-xs text-muted-foreground">Nothing here</p>
              ) : (
                <ul className="space-y-2">
                  {column.map((task) => (
                    <BoardCard
                      key={task.id}
                      task={task}
                      showOwner={showOwner}
                      editable={canEdit(task)}
                      onStatus={onStatus}
                      onOpen={onOpen}
                      busy={busy}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  showOwner,
  editable,
  onStatus,
  onOpen,
  busy,
}: {
  task: Task;
  showOwner: boolean;
  editable: boolean;
  onStatus: (task: Task, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
  busy?: boolean;
}) {
  const done = task.status === 'completed';
  const title = (
    <span className="line-clamp-2 font-display text-[13px] leading-snug font-semibold text-ink">
      {task.title}
    </span>
  );
  return (
    <li className="rounded-xl border border-line bg-surface p-3 shadow-soft">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="block w-full text-left hover:text-primary"
        aria-label={`Open ${task.title}`}
      >
        {title}
      </button>
      {showOwner ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
          <Avatar name={task.owner.displayName} seed={task.owner.id} size="xs" />
          <span className="truncate">{task.owner.displayName}</span>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
        {task.dueDate ? (
          <span className={clsx('flex items-center gap-1', task.late && 'font-medium text-danger')}>
            <CalendarDays aria-hidden className="size-3" />
            {formatShortDate(task.dueDate)}
            {task.late ? (done ? ' · late' : ' · overdue') : ''}
          </span>
        ) : null}
        {task.spentHours > 0 || task.estimateHours != null ? (
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-3" />
            {formatHours(task.spentHours)}
            {task.estimateHours != null ? ` of ${formatHours(task.estimateHours)}` : ''}
          </span>
        ) : null}
      </div>
      {editable ? (
        <Select
          label={`Move ${task.title}`}
          hideLabel
          className="mt-2.5"
          triggerClassName="h-8 px-2 text-[11.5px]"
          value={task.status}
          disabled={busy}
          onChange={(v) => onStatus(task, v as TaskStatus)}
          options={STATUS_OPTIONS}
        />
      ) : null}
    </li>
  );
}
