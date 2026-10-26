import type { Task, TaskStatus } from '@ado-metrics/shared';
import { CalendarDays, Clock, Link2, Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/shadcn/sheet';
import { isApiError } from '../../api/client';
import { useAddTaskComment, useTaskComments } from '../../api/tasks';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useMe } from '../../lib/auth';
import { formatDateTime, formatHours, formatShortDate } from '../../lib/format';
import { STATUS_LABEL, STATUS_OPTIONS } from './taskLabels';

interface TaskDetailSheetProps {
  task: Task | null;
  editable: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  busy?: boolean;
}

/** Side panel for one task: the facts, its description and the discussion. */
export function TaskDetailSheet({
  task,
  editable,
  onClose,
  onEdit,
  onStatus,
  busy,
}: TaskDetailSheetProps) {
  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {task ? (
          <TaskDetail
            key={task.id}
            task={task}
            editable={editable}
            onEdit={onEdit}
            onStatus={onStatus}
            busy={busy}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetail({
  task,
  editable,
  onEdit,
  onStatus,
  busy,
}: Omit<TaskDetailSheetProps, 'task' | 'onClose'> & { task: Task }) {
  const me = useMe();
  const projectId = me.projects[0]?.id;
  const done = task.status === 'completed';
  return (
    <>
      <SheetHeader className="border-b px-6 pt-6 pb-4">
        <SheetTitle className="pr-8 font-display text-lg leading-snug">{task.title}</SheetTitle>
        <SheetDescription className="flex items-center gap-2 text-sm">
          <Avatar name={task.owner.displayName} seed={task.owner.id} size="xs" />
          {task.owner.displayName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-end gap-3">
          {editable ? (
            <Select
              label="Status"
              className="w-48"
              value={task.status}
              disabled={busy}
              onChange={(v) => onStatus(task, v as TaskStatus)}
              options={STATUS_OPTIONS}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="text-sm font-medium">{STATUS_LABEL[task.status]}</span>
            </div>
          )}
          {editable ? (
            <Button
              variant="ghost"
              icon={<Pencil aria-hidden className="size-4" />}
              onClick={() => onEdit(task)}
              className="ml-auto"
            >
              Edit task
            </Button>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label="Due">
            {task.dueDate ? (
              <span className={task.late ? 'font-medium text-danger' : undefined}>
                <CalendarDays aria-hidden className="mr-1 inline size-3.5" />
                {formatShortDate(task.dueDate)}
                {task.late ? (done ? ' · late' : ' · overdue') : ''}
              </span>
            ) : (
              'No due date'
            )}
          </Fact>
          <Fact label="Hours">
            <Clock aria-hidden className="mr-1 inline size-3.5" />
            {formatHours(task.spentHours)}
            {task.estimateHours != null ? ` of ${formatHours(task.estimateHours)}` : ''}
          </Fact>
          <Fact label="Azure DevOps story">
            {task.workItemId ? (
              projectId ? (
                <Link
                  to={`/projects/${encodeURIComponent(projectId)}/work-items/${task.workItemId}`}
                  className="text-primary hover:underline"
                >
                  <Link2 aria-hidden className="mr-1 inline size-3.5" />#{task.workItemId}
                </Link>
              ) : (
                `#${task.workItemId}`
              )
            ) : (
              'Not linked'
            )}
          </Fact>
          <Fact label="Last updated">{formatDateTime(task.updatedAt)}</Fact>
        </dl>

        <section aria-labelledby="task-description">
          <h3 id="task-description" className="mb-2 font-display text-sm font-semibold">
            Description
          </h3>
          {task.notes ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
              {task.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No description yet.
              {editable ? (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="text-primary hover:underline"
                  >
                    Add one
                  </button>
                </>
              ) : null}
            </p>
          )}
        </section>

        <Comments taskId={task.id} />
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function Comments({ taskId }: { taskId: string }) {
  const comments = useTaskComments(taskId);
  const add = useAddTaskComment(taskId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Write a comment first.');
      return;
    }
    setError(null);
    add.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: (err) =>
        setError(isApiError(err) ? (err.detail ?? err.title) : 'Could not post the comment.'),
    });
  }

  const list = comments.data ?? [];
  return (
    <section aria-labelledby="task-comments">
      <h3 id="task-comments" className="mb-3 font-display text-sm font-semibold">
        Comments{' '}
        {list.length ? (
          <span className="font-normal text-muted-foreground">· {list.length}</span>
        ) : null}
      </h3>
      {comments.isPending ? (
        <SkeletonRows rows={2} label="Loading comments…" />
      ) : list.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="mb-4 space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.displayName} seed={c.author.id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold text-ink">{c.author.displayName}</span>{' '}
                  <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-2">
        <label htmlFor="task-comment" className="sr-only">
          Add a comment
        </label>
        <TextArea
          id="task-comment"
          value={text}
          maxLength={2000}
          rows={3}
          invalid={!!error}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment: feedback, a question, a blocker…"
        />
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={add.isPending}>
            {add.isPending ? 'Posting…' : 'Comment'}
          </Button>
        </div>
      </form>
    </section>
  );
}
