import type { CreateTaskBody, Paged, Task, TaskComment, TaskListQuery, TaskSummary, UpdateTaskBody } from '@ado-metrics/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, seg } from './client';
import { qk } from './queryKeys';

export type TaskParams = Partial<TaskListQuery> & { [key: string]: string | number | undefined };

export function useTasks(params: TaskParams, enabled = true) {
  return useQuery({
    queryKey: qk.tasks(params),
    queryFn: ({ signal }) => api.get<Paged<Task>>('/tasks', params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTaskSummary(weeks: number) {
  return useQuery({
    queryKey: qk.taskSummary(weeks),
    queryFn: ({ signal }) => api.get<TaskSummary>('/tasks/summary', { weeks }, signal),
  });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.tasksAll });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (body: CreateTaskBody) => api.post<Task>('/tasks', body),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskBody }) => api.patch<Task>(`/tasks/${seg(id)}`, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/tasks/${seg(id)}`),
    onSuccess: invalidate,
  });
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: qk.taskComments(taskId ?? ''),
    queryFn: ({ signal }) => api.get<TaskComment[]>(`/tasks/${seg(taskId!)}/comments`, undefined, signal),
    enabled: !!taskId,
  });
}

export function useAddTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<TaskComment>(`/tasks/${seg(taskId)}/comments`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taskComments(taskId) }),
  });
}
