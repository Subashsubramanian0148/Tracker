import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateDelayReasonBody,
  DelayCategory,
  DelayedItem,
  DelayFlag,
  DelayListQuery,
  DelayReason,
  Paged,
  UpsertDelayCategoryBody,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { hasRole } from '../common/guards';
import { ScopeService } from '../common/scope.service';
import type { SessionUser } from '../common/session.types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDelayReason } from '../work-items/mappers';
import { WorkItemsService } from '../work-items/work-items.service';

@Injectable()
export class DelaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly workItems: WorkItemsService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string, q: DelayListQuery, user: SessionUser): Promise<Paged<DelayedItem>> {
    const reasonFilter: Prisma.WorkItemWhereInput =
      q.status === 'open'
        ? { delayReasons: { none: { supersededAt: null } } }
        : q.status === 'explained'
          ? { delayReasons: { some: { supersededAt: null } } }
          : {};
    const where: Prisma.WorkItemWhereInput = {
      AND: [{ projectId, isDeleted: false, isDelayed: true }, reasonFilter, await this.scope.teamWhere(projectId, q.teamId)],
    };
    const [total, rows] = await Promise.all([
      this.prisma.workItem.count({ where }),
      this.prisma.workItem.findMany({
        where,
        include: {
          _count: { select: { delayReasons: { where: { supersededAt: null } } } },
          delayReasons: { where: { supersededAt: null }, include: { category: true }, take: 1 },
        },
        orderBy: [{ delayDetectedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const summaries = await this.workItems.summaries(projectId, rows, user);
    return {
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((r, i) => ({
        workItem: summaries[i]!,
        flags: r.delayFlags as DelayFlag[],
        detectedAt: (r.delayDetectedAt ?? r.changedDate).toISOString(),
        latestReason: r.delayReasons[0] ? toDelayReason(r.delayReasons[0]) : null,
      })),
    };
  }

  /**
   * Records why an item is delayed. Allowed for Team Leads, Managers, Admins and the item's
   * assignee. The previous current reason is superseded, never deleted.
   */
  async addReason(
    projectId: string,
    workItemId: number,
    body: CreateDelayReasonBody,
    user: SessionUser,
    req: Request,
  ): Promise<DelayReason> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, isDeleted: false },
      select: { id: true, assignedToId: true },
    });
    if (!item) throw new NotFoundException('Work item not found');

    if (!hasRole(user.roles, 'TeamLead', 'Manager')) {
      const me = await this.prisma.person.findMany({ where: { uniqueName: user.email }, select: { id: true } });
      const isAssignee = !!item.assignedToId && me.some((p) => p.id === item.assignedToId);
      if (!isAssignee) {
        await this.audit.record({
          action: 'delay_reason.create',
          outcome: 'denied',
          actor: user,
          targetType: 'work_item',
          targetId: workItemId,
          req,
        });
        throw new ForbiddenException('Only the assignee, team leads and managers can explain delays');
      }
    }

    const category = await this.prisma.delayCategory.findUnique({ where: { id: body.categoryId } });
    if (!category || !category.active) throw new BadRequestException('Unknown or inactive delay category');

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.delayReason.updateMany({
        where: { workItemId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      return tx.delayReason.create({
        data: {
          workItemId,
          categoryId: category.id,
          comment: body.comment,
          impactDays: body.impactDays ?? null,
          createdById: user.id,
          createdByName: user.displayName,
        },
        include: { category: true },
      });
    });

    await this.audit.record({
      action: 'delay_reason.create',
      outcome: 'success',
      actor: user,
      targetType: 'work_item',
      targetId: workItemId,
      details: { reasonId: created.id, categoryId: category.id, impactDays: body.impactDays ?? null },
      req,
    });
    return toDelayReason(created);
  }

  async categories(): Promise<DelayCategory[]> {
    const rows = await this.prisma.delayCategory.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toCategory);
  }

  async createCategory(body: UpsertDelayCategoryBody, user: SessionUser, req: Request): Promise<DelayCategory> {
    try {
      const row = await this.prisma.delayCategory.create({
        data: { name: body.name, description: body.description ?? null, active: body.active },
      });
      await this.audit.record({ action: 'delay_category.create', outcome: 'success', actor: user, targetType: 'delay_category', targetId: row.id, details: { name: row.name }, req });
      return toCategory(row);
    } catch (err) {
      throw uniqueViolation(err) ? new ConflictException('A category with this name already exists') : err;
    }
  }

  async updateCategory(id: string, body: UpsertDelayCategoryBody, user: SessionUser, req: Request): Promise<DelayCategory> {
    const existing = await this.prisma.delayCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    try {
      const row = await this.prisma.delayCategory.update({
        where: { id },
        data: { name: body.name, description: body.description ?? null, active: body.active },
      });
      await this.audit.record({
        action: 'delay_category.update',
        outcome: 'success',
        actor: user,
        targetType: 'delay_category',
        targetId: id,
        details: { before: { name: existing.name, active: existing.active }, after: { name: row.name, active: row.active } },
        req,
      });
      return toCategory(row);
    } catch (err) {
      throw uniqueViolation(err) ? new ConflictException('A category with this name already exists') : err;
    }
  }
}

function toCategory(r: { id: string; name: string; description: string | null; active: boolean }): DelayCategory {
  return { id: r.id, name: r.name, description: r.description, active: r.active };
}

function uniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
