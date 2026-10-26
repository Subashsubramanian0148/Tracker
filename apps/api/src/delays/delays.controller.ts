import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  createDelayReasonBody,
  delayListQuery,
  guid,
  upsertDelayCategoryBody,
  workItemId,
  type CreateDelayReasonBody,
  type DelayCategory,
  type DelayedItem,
  type DelayListQuery,
  type DelayReason,
  type Paged,
  type UpsertDelayCategoryBody,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { CurrentUser, Roles } from '../common/decorators';
import { ProjectAccessGuard } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { DelaysService } from './delays.service';

@Controller('projects/:projectId')
@UseGuards(ProjectAccessGuard)
export class DelaysController {
  constructor(private readonly delays: DelaysService) {}

  @Get('delays')
  list(
    @Param('projectId') projectId: string,
    @Query(new ZodPipe(delayListQuery)) q: DelayListQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<Paged<DelayedItem>> {
    return this.delays.list(projectId, q, user);
  }

  @Post('work-items/:id/delay-reasons')
  @HttpCode(201)
  addReason(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @Body(new ZodPipe(createDelayReasonBody)) body: CreateDelayReasonBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<DelayReason> {
    return this.delays.addReason(projectId, id, body, user, req);
  }
}

@Controller()
export class DelayCategoriesController {
  constructor(private readonly delays: DelaysService) {}

  @Get('delay-categories')
  list(): Promise<DelayCategory[]> {
    return this.delays.categories();
  }

  @Post('admin/delay-categories')
  @Roles('Admin')
  @HttpCode(201)
  create(
    @Body(new ZodPipe(upsertDelayCategoryBody)) body: UpsertDelayCategoryBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<DelayCategory> {
    return this.delays.createCategory(body, user, req);
  }

  @Put('admin/delay-categories/:id')
  @Roles('Admin')
  update(
    @Param('id', new ZodPipe(guid)) id: string,
    @Body(new ZodPipe(upsertDelayCategoryBody)) body: UpsertDelayCategoryBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<DelayCategory> {
    return this.delays.updateCategory(id, body, user, req);
  }
}
