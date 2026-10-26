import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateTaskBody,
  Paged,
  Task,
  TaskListQuery,
  TaskComment,
  TaskStatus,
  TaskSummary,
  UpdateTaskBody,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { hasRole, isManager } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import type { Prisma, Task as TaskRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyStatus, buildSummary, isLate } from './task-rules';

const canEditOthers = (user: SessionUser) => hasRole(user.roles, 'TeamLead', 'Manager');
const toDate = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00Z`) : null);

function toTask(r: TaskRow, now = new Date()): Task {
  return {
    id: r.id,
    owner: { id: r.ownerId, displayName: r.ownerName },
    title: r.title,
    notes: r.notes,
    status: r.status as TaskStatus,
    workItemId: r.workItemId,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    estimateHours: r.estimateHours,
    spentHours: r.spentHours,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    late: isLate(
      { status: r.status as TaskStatus, dueDate: r.dueDate, completedAt: r.completedAt },
      now,
    ),
  };
}

const toComment = (r: {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}): TaskComment => ({
  id: r.id,
  author: { id: r.authorId, displayName: r.authorName },
  body: r.body,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: TaskListQuery, user: SessionUser, req: Request): Promise<Paged<Task>> {
    const where: Prisma.TaskWhereInput = {
      ...(await this.visibleTasks(user, req)),
      ...(q.scope === 'mine' ? { ownerId: user.id } : q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.status === 'open'
        ? { status: { not: 'completed' } }
        : q.status !== 'all'
          ? { status: q.status }
          : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        // Open work first, nearest due date first; finished work newest first.
        orderBy: [
          { completedAt: { sort: 'desc', nulls: 'first' } },
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    if (q.scope === 'team') {
      await this.audit.record({
        action: 'tasks.team_view',
        outcome: 'success',
        actor: user,
        details: { ownerId: q.ownerId ?? null },
        req,
      });
    }
    const now = new Date();
    return { items: rows.map((r) => toTask(r, now)), page: q.page, pageSize: q.pageSize, total };
  }

  async summary(weeks: number, user: SessionUser, req: Request): Promise<TaskSummary> {
    const now = new Date();
    const since = new Date(now.getTime() - weeks * 7 * 86_400_000);
    const rows = await this.prisma.task.findMany({
      where: {
        AND: [
          await this.visibleTasks(user, req),
          {
            OR: [
              { status: { not: 'completed' } },
              { completedAt: { gte: since } },
              { createdAt: { gte: since } },
            ],
          },
        ],
      },
      select: {
        ownerId: true,
        ownerName: true,
        status: true,
        dueDate: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      action: 'tasks.summary_view',
      outcome: 'success',
      actor: user,
      details: { weeks },
      req,
    });
    return buildSummary(
      rows.map((r) => ({ ...r, status: r.status as TaskStatus })),
      weeks,
      now,
    );
  }

  async create(body: CreateTaskBody, user: SessionUser, req: Request): Promise<Task> {
    const now = new Date();
    const times = applyStatus(
      { status: 'upcoming', dueDate: null, startedAt: null, completedAt: null },
      body.status,
      now,
    );
    await this.assertWorkItemVisible(body.workItemId, user, req);
    const row = await this.prisma.task.create({
      data: {
        ownerId: user.id,
        ownerName: user.displayName,
        title: body.title,
        notes: body.notes ?? null,
        status: body.status,
        workItemId: body.workItemId ?? null,
        dueDate: toDate(body.dueDate),
        estimateHours: body.estimateHours ?? null,
        spentHours: body.spentHours ?? 0,
        ...times,
      },
    });
    await this.audit.record({
      action: 'task.create',
      outcome: 'success',
      actor: user,
      targetType: 'task',
      targetId: row.id,
      details: { status: row.status },
      req,
    });
    return toTask(row, now);
  }

  async update(id: string, body: UpdateTaskBody, user: SessionUser, req: Request): Promise<Task> {
    const existing = await this.ownTask(id, user, req, 'task.update');
    await this.assertWorkItemVisible(body.workItemId, user, req);
    const now = new Date();
    const status = body.status ?? (existing.status as TaskStatus);
    const times = applyStatus({ ...existing, status: existing.status as TaskStatus }, status, now);
    const row = await this.prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.workItemId !== undefined ? { workItemId: body.workItemId } : {}),
        ...(body.dueDate !== undefined ? { dueDate: toDate(body.dueDate) } : {}),
        ...(body.estimateHours !== undefined ? { estimateHours: body.estimateHours } : {}),
        ...(body.spentHours !== undefined ? { spentHours: body.spentHours } : {}),
        status,
        ...times,
      },
    });
    await this.audit.record({
      action: 'task.update',
      outcome: 'success',
      actor: user,
      targetType: 'task',
      targetId: id,
      details: {
        fields: Object.keys(body),
        ...(status !== existing.status ? { from: existing.status, to: status } : {}),
      },
      req,
    });
    return toTask(row, now);
  }

  async remove(id: string, user: SessionUser, req: Request): Promise<void> {
    await this.ownTask(id, user, req, 'task.delete');
    await this.prisma.task.delete({ where: { id } });
    await this.audit.record({
      action: 'task.delete',
      outcome: 'success',
      actor: user,
      targetType: 'task',
      targetId: id,
      req,
    });
  }

  /** Everyone signed in can read the team board, so everyone can read and join a task's discussion. */
  async comments(taskId: string, user: SessionUser, req: Request): Promise<TaskComment[]> {
    await this.findTask(taskId, user, req);
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toComment);
  }

  async addComment(
    taskId: string,
    body: string,
    user: SessionUser,
    req: Request,
  ): Promise<TaskComment> {
    await this.findTask(taskId, user, req);
    const row = await this.prisma.taskComment.create({
      data: { taskId, authorId: user.id, authorName: user.displayName, body },
    });
    await this.audit.record({
      action: 'task.comment',
      outcome: 'success',
      actor: user,
      targetType: 'task',
      targetId: taskId,
      req,
    });
    return toComment(row);
  }

  /** A task the user may see; tasks linked to a project they can't access read as missing. */
  private async findTask(id: string, user: SessionUser, req: Request) {
    const row = await this.prisma.task.findFirst({
      where: { id, ...(await this.visibleTasks(user, req)) },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Task not found');
    return row;
  }

  /**
   * Tasks follow project access: unlinked tasks are visible to everyone, linked ones only to
   * people who can see that work item's project. Managers see all.
   */
  private async visibleTasks(user: SessionUser, req: Request): Promise<Prisma.TaskWhereInput> {
    if (isManager(user.roles)) return {};
    const items = await this.prisma.workItem.findMany({
      where: { projectId: { in: req.session.projectIds ?? [] } },
      select: { id: true },
    });
    return { OR: [{ workItemId: null }, { workItemId: { in: items.map((i) => i.id) } }] };
  }

  /** A task may only link to a work item in a project the user can see. */
  private async assertWorkItemVisible(
    workItemId: number | null | undefined,
    user: SessionUser,
    req: Request,
  ): Promise<void> {
    if (workItemId == null || isManager(user.roles)) return;
    const item = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId: { in: req.session.projectIds ?? [] } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Work item not found');
  }

  /** Designers change only their own tasks; Team Leads and Managers can change anyone's. */
  private async ownTask(
    id: string,
    user: SessionUser,
    req: Request,
    action: string,
  ): Promise<TaskRow> {
    const row = await this.prisma.task.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Task not found');
    if (row.ownerId !== user.id && !canEditOthers(user)) {
      await this.audit.record({
        action,
        outcome: 'denied',
        actor: user,
        targetType: 'task',
        targetId: id,
        req,
      });
      throw new ForbiddenException('Designers can only change their own tasks');
    }
    return row;
  }
}
