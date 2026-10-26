import type { Task, TaskStatus } from '@ado-metrics/shared';
import clsx from 'clsx';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { isApiError } from '../../api/client';
import { useTasks, useTaskSummary, useUpdateTask } from '../../api/tasks';
import { SectionToolbar } from '../../app/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ChartFigure, LegendItem } from '../../components/ui/ChartFigure';
import { ErrorState } from '../../components/ui/ErrorState';
import { KpiTile } from '../../components/ui/KpiTile';
import { Select } from '../../components/ui/Select';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { canEditTeamTasks, useMe } from '../../lib/auth';
import { formatPercent, formatShortDate } from '../../lib/format';
import { STATUS_LABEL } from './taskLabels';
import { TaskDialog } from './TaskDialog';
import { TaskBoard } from './TaskBoard';
import { TaskDetailSheet } from './TaskDetailSheet';

const DONE = '#1baf7a';
const LATE = '#d97706';
const CREATED = '#c9ccd3';
const AXIS = { fontSize: 12, fill: '#6b6b6b' };
const PAGE_SIZE = 200;

/** Everyone sees who is working on what; Team Leads and Managers can also edit any task here. */
export function TeamTasksPage() {
  const me = useMe();
  const canEdit = canEditTeamTasks(me.user);
  const update = useUpdateTask();
  const toast = useToast();
  const [editing, setEditing] = useState<Task | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const summary = useTaskSummary(weeks);
  const tasks = useTasks({ scope: 'team', status: 'all', ownerId, page: 1, pageSize: PAGE_SIZE });
  const t = summary.data?.totals;
  const openTask = tasks.data?.items.find((x) => x.id === openId) ?? null;
  const owner = summary.data?.people.find((p) => p.owner.id === ownerId)?.owner;

  function setTaskStatus(task: Task, next: TaskStatus) {
    update.mutate(
      { id: task.id, body: { status: next } },
      {
        onSuccess: () =>
          toast.success(`${task.owner.displayName}'s task moved to ${STATUS_LABEL[next]}`),
        onError: (e) =>
          toast.error(
            'Could not update the task',
            isApiError(e) ? (e.detail ?? e.title) : undefined,
          ),
      },
    );
  }

  const pick = (id: string | undefined) => {
    setOwnerId(id);
  };

  return (
    <div className="space-y-8">
      <section aria-label="Team board">
        <SectionToolbar
          title={owner ? `${owner.displayName}'s tasks` : 'Team tasks'}
          right={
            owner ? (
              <Button variant="ghost" onClick={() => pick(undefined)}>
                Show everyone
              </Button>
            ) : undefined
          }
        />
        {tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : tasks.isPending ? (
          <SkeletonRows rows={5} label="Loading team tasks…" />
        ) : (
          <TaskBoard
            tasks={tasks.data.items}
            showOwner
            canEdit={(task) => canEdit || task.owner.id === me.user.id}
            onStatus={setTaskStatus}
            onOpen={(task) => setOpenId(task.id)}
            busy={update.isPending}
          />
        )}
      </section>

      <section aria-label="Team progress">
        <SectionToolbar
          title="Team progress"
          right={
            <Select
              label="Period"
              hideLabel
              className="w-40"
              value={String(weeks)}
              onChange={(v) => setWeeks(Number(v))}
              options={[4, 8, 12, 26].map((w) => ({ value: String(w), label: `Last ${w} weeks` }))}
            />
          }
        />
        {summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile label="Upcoming" value={t?.upcoming ?? '—'} loading={summary.isPending} />
              <KpiTile label="Started" value={t?.started ?? '—'} loading={summary.isPending} />
              <KpiTile
                label="In progress"
                value={t?.inProgress ?? '—'}
                loading={summary.isPending}
              />
              <KpiTile
                label="Approval pending"
                value={t?.approvalPending ?? '—'}
                hint="Waiting for sign-off"
                loading={summary.isPending}
                tone={t?.approvalPending ? 'warn' : 'default'}
              />
              <KpiTile
                label="Reopened"
                value={t?.reopened ?? '—'}
                hint="Sent back for changes"
                loading={summary.isPending}
                tone={t?.reopened ? 'warn' : 'default'}
              />
              <KpiTile
                label="Overdue"
                value={t?.overdue ?? '—'}
                hint="Open and past due"
                loading={summary.isPending}
                tone={t?.overdue ? 'warn' : 'default'}
              />
              <KpiTile
                label="Completed"
                value={t?.completed ?? '—'}
                hint={`Last ${weeks} weeks`}
                loading={summary.isPending}
                tone="good"
              />
              <KpiTile
                label="On time"
                value={formatPercent(summary.data?.onTimeRate)}
                hint="Completed by the due date"
                loading={summary.isPending}
              />
            </div>

            {summary.data ? (
              <div className="mt-5 grid gap-5">
                <ChartFigure
                  title="Are we keeping up?"
                  summary="Tasks added vs finished each week. Orange is work completed after its due date."
                  legend={
                    <>
                      <LegendItem color={CREATED} label="Added" />
                      <LegendItem color={DONE} label="Completed on time" />
                      <LegendItem color={LATE} label="Completed late" />
                    </>
                  }
                  table={{
                    columns: ['Week of', 'Added', 'Finished', 'Finished late'],
                    rows: summary.data.weekly.map((w) => [
                      formatShortDate(w.weekStart),
                      String(w.created),
                      String(w.completed),
                      String(w.completedLate),
                    ]),
                  }}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={summary.data.weekly.map((w) => ({
                        ...w,
                        onTime: w.completed - w.completedLate,
                        label: formatShortDate(w.weekStart),
                      }))}
                      margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                      accessibilityLayer={false}
                    >
                      <CartesianGrid stroke="#ececec" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={AXIS}
                        tickLine={false}
                        axisLine={{ stroke: '#ececec' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={AXIS}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip cursor={{ fill: '#f3f3f4' }} />
                      <Bar
                        dataKey="created"
                        name="Added"
                        fill={CREATED}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={18}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="onTime"
                        name="Finished on time"
                        stackId="done"
                        fill={DONE}
                        maxBarSize={18}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="completedLate"
                        name="Finished late"
                        stackId="done"
                        fill={LATE}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={18}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFigure>

                <div className="min-w-0">
                  <h3 className="mb-2 font-display text-sm font-semibold">By person</h3>
                  {summary.data.people.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No one has logged tasks in this period.
                    </p>
                  ) : (
                    <Table caption="Tasks per person. Select a name to see their tasks.">
                      <thead>
                        <tr>
                          <Th>Person</Th>
                          <Th className="text-right">Upcoming</Th>
                          <Th className="text-right">Started</Th>
                          <Th className="text-right">In progress</Th>
                          <Th className="text-right">Approval</Th>
                          <Th className="text-right">Reopened</Th>
                          <Th className="text-right">Overdue</Th>
                          <Th className="text-right">Completed</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.data.people.map((p) => (
                          <Tr
                            key={p.owner.id}
                            className={clsx(p.owner.id === ownerId && 'bg-pill')}
                          >
                            <Td>
                              <button
                                type="button"
                                onClick={() =>
                                  pick(p.owner.id === ownerId ? undefined : p.owner.id)
                                }
                                aria-pressed={p.owner.id === ownerId}
                                className="flex items-center gap-2 text-left font-medium hover:text-primary"
                              >
                                <Avatar name={p.owner.displayName} seed={p.owner.id} size="xs" />
                                {p.owner.displayName}
                              </button>
                            </Td>
                            <Td className="text-right tabular-nums">{p.upcoming}</Td>
                            <Td className="text-right tabular-nums">{p.started}</Td>
                            <Td className="text-right tabular-nums">{p.inProgress}</Td>
                            <Td
                              className={clsx(
                                'text-right tabular-nums',
                                p.approvalPending && 'font-semibold text-amber-ink',
                              )}
                            >
                              {p.approvalPending}
                            </Td>
                            <Td
                              className={clsx(
                                'text-right tabular-nums',
                                p.reopened && 'font-semibold text-danger',
                              )}
                            >
                              {p.reopened}
                            </Td>
                            <Td
                              className={clsx(
                                'text-right tabular-nums',
                                p.overdue && 'font-semibold text-danger',
                              )}
                            >
                              {p.overdue}
                            </Td>
                            <Td className="text-right tabular-nums">{p.completed}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
      <TaskDetailSheet
        task={openTask}
        editable={!!openTask && (canEdit || openTask.owner.id === me.user.id)}
        onClose={() => setOpenId(null)}
        onEdit={(task) => {
          setOpenId(null);
          setEditing(task);
        }}
        onStatus={setTaskStatus}
        busy={update.isPending}
      />
      <TaskDialog open={!!editing} task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
