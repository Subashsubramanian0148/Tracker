import type { CreateTaskBody, Task, TaskStatus } from '@ado-metrics/shared';
import { ChevronRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/collapsible';
import { isApiError } from '../../api/client';
import { useCreateTask, useDeleteTask, useUpdateTask } from '../../api/tasks';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { FieldWrapper, TextArea, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { useMe } from '../../lib/auth';
import { STATUS_OPTIONS } from './taskLabels';

type Field = 'title' | 'workItemId' | 'estimateHours' | 'spentHours';
type Errors = Partial<Record<Field | 'form', string>>;

interface TaskDialogProps {
  open: boolean;
  /** Task being edited, or null for a new one. */
  task: Task | null;
  onClose: () => void;
}

export function TaskDialog({ open, task, onClose }: TaskDialogProps) {
  const me = useMe();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      description={
        task && task.owner.id !== me.user.id
          ? `You are editing ${task.owner.displayName}'s task as their lead.`
          : 'Everyone sees your tasks in the Team view. Only you, your lead and your manager can change them.'
      }
    >
      <TaskForm key={task?.id ?? 'new'} task={task} onDone={onClose} />
    </Modal>
  );
}

const num = (s: string) => (s.trim() === '' ? null : Number(s));

export function validateTask(v: {
  title: string;
  workItemId: string;
  estimateHours: string;
  spentHours: string;
}): Errors {
  const e: Errors = {};
  const len = v.title.trim().length;
  if (len < 2) e.title = 'Give the task a short title.';
  else if (len > 200) e.title = 'Keep the title under 200 characters.';
  const wi = num(v.workItemId);
  if (wi !== null && (!Number.isInteger(wi) || wi <= 0))
    e.workItemId = 'Enter an Azure DevOps ID, like 1079.';
  const est = num(v.estimateHours);
  if (est !== null && (!Number.isFinite(est) || est < 0 || est > 1000))
    e.estimateHours = 'Enter hours between 0 and 1000.';
  const spent = num(v.spentHours);
  if (spent !== null && (!Number.isFinite(spent) || spent < 0 || spent > 10_000))
    e.spentHours = 'Enter hours of 0 or more.';
  return e;
}

function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toast = useToast();
  const [title, setTitle] = useState(task?.title ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'upcoming');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [workItemId, setWorkItemId] = useState(task?.workItemId ? String(task.workItemId) : '');
  const [estimateHours, setEstimateHours] = useState(
    task?.estimateHours != null ? String(task.estimateHours) : '',
  );
  const [spentHours, setSpentHours] = useState(task ? String(task.spentHours) : '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = create.isPending || update.isPending || remove.isPending;
  const [detailsOpen, setDetailsOpen] = useState(
    !!task &&
      (task.estimateHours != null ||
        task.spentHours > 0 ||
        task.workItemId != null ||
        !!task.notes),
  );

  const fail = (err: unknown) =>
    setErrors({
      form: isApiError(err)
        ? `${err.detail ?? err.title}${err.traceId ? ` · Trace ${err.traceId}` : ''}`
        : 'Could not save the task.',
    });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateTask({ title, workItemId, estimateHours, spentHours });
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(`task-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    const body: CreateTaskBody = {
      title: title.trim(),
      status,
      notes: notes.trim() || null,
      dueDate: dueDate || null,
      workItemId: num(workItemId),
      estimateHours: num(estimateHours),
      spentHours: num(spentHours) ?? 0,
    };
    const done = {
      onSuccess: () => {
        toast.success(task ? 'Task updated' : 'Task added');
        onDone();
      },
      onError: fail,
    };
    if (task) update.mutate({ id: task.id, body }, done);
    else create.mutate(body, done);
  }

  function onDelete() {
    if (!task) return;
    remove.mutate(task.id, {
      onSuccess: () => {
        toast.success('Task deleted');
        onDone();
      },
      onError: fail,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.form ? (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {errors.form}
        </div>
      ) : null}
      <FieldWrapper id="task-title" label="What are you working on?" required error={errors.title}>
        <TextInput
          id="task-title"
          value={title}
          maxLength={200}
          autoFocus
          invalid={!!errors.title}
          aria-required
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Checkout flow — high-fidelity mockups"
        />
      </FieldWrapper>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="task-status"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as TaskStatus)}
          options={STATUS_OPTIONS}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-due" className="text-xs font-medium text-muted-foreground">
            Due date (optional)
          </label>
          <DatePicker
            id="task-due"
            value={dueDate}
            onChange={setDueDate}
            placeholder="No due date"
          />
        </div>
      </div>
      {/* Optional details stay folded so adding a task is one line plus Enter. */}
      <Collapsible
        open={detailsOpen || Object.keys(errors).some((k) => k !== 'title' && k !== 'form')}
        onOpenChange={setDetailsOpen}
        className="rounded-lg border px-4 py-3"
      >
        <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 text-sm font-medium text-secondary-foreground">
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform group-data-[state=open]:rotate-90"
          />
          More details: description, hours, story link
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper
              id="task-estimateHours"
              label="Estimate (hours)"
              error={errors.estimateHours}
            >
              <TextInput
                id="task-estimateHours"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={estimateHours}
                invalid={!!errors.estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
              />
            </FieldWrapper>
            <FieldWrapper
              id="task-spentHours"
              label="Time spent so far (hours)"
              error={errors.spentHours}
            >
              <TextInput
                id="task-spentHours"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={spentHours}
                invalid={!!errors.spentHours}
                onChange={(e) => setSpentHours(e.target.value)}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper
            id="task-workItemId"
            label="Azure DevOps story ID"
            error={errors.workItemId}
            hint="Links the task to its story"
          >
            <TextInput
              id="task-workItemId"
              inputMode="numeric"
              value={workItemId}
              invalid={!!errors.workItemId}
              onChange={(e) => setWorkItemId(e.target.value)}
              className="max-w-40"
              placeholder="1079"
            />
          </FieldWrapper>
          <FieldWrapper id="task-notes" label="Description" hint={`${notes.length} / 2000`}>
            <TextArea
              id="task-notes"
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What the task covers, links, what's left"
            />
          </FieldWrapper>
        </CollapsibleContent>
      </Collapsible>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {task ? (
          confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              Delete this task?
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onDelete}
                disabled={pending}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Keep
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete task
            </Button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </form>
  );
}
