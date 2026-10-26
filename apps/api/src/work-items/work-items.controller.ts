import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  workItemId,
  workItemListQuery,
  type Paged,
  type WorkItemDetail,
  type WorkItemListQuery,
  type WorkItemSummary,
} from '@ado-metrics/shared';
import { CurrentUser } from '../common/decorators';
import { ProjectAccessGuard } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { WorkItemsService } from './work-items.service';

@Controller('projects/:projectId/work-items')
@UseGuards(ProjectAccessGuard)
export class WorkItemsController {
  constructor(private readonly items: WorkItemsService) {}

  @Get()
  list(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(workItemListQuery)) q: WorkItemListQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<Paged<WorkItemSummary>> {
    return this.items.list(projectId, q, user);
  }

  @Get(':id')
  detail(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkItemDetail> {
    return this.items.detail(projectId, id, user);
  }
}
