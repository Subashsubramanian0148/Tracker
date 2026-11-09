import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  dismissDelayBody,
  workItemId,
  type DismissDelayBody,
  workItemListQuery,
  type Paged,
  type WorkItemAiSummary,
  type WorkItemDetail,
  type WorkItemListQuery,
  type WorkItemSummary,
} from '@ado-metrics/shared';
import { CurrentUser } from '../common/decorators';
import { ProjectAccessGuard } from '../common/guards';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { SummaryService } from './summary.service';
import { WorkItemsService } from './work-items.service';

@Controller('projects/:projectId/work-items')
@UseGuards(ProjectAccessGuard)
export class WorkItemsController {
  constructor(
    private readonly items: WorkItemsService,
    private readonly summaries: SummaryService,
  ) {}

  /** Whether AI summaries are set up, so the page knows to show the button. */
  @Get('summary-enabled')
  summaryEnabled(): { enabled: boolean } {
    return { enabled: this.summaries.enabled };
  }

  /** AI summary of the story, its tasks and its parent. Only runs when someone asks. */
  @Post(':id/summary')
  @HttpCode(200)
  summary(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkItemAiSummary> {
    return this.summaries.summarise(projectId, id, user);
  }

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

  /** "Not a blocker": the comment's tags stop counting. */
  @Put(':id/comments/:commentId/ignore')
  @HttpCode(204)
  ignoreComment(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @Param('commentId', new ZodPipe(workItemId)) commentId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.items.setCommentIgnored(projectId, id, commentId, true, user);
  }

  @Delete(':id/comments/:commentId/ignore')
  @HttpCode(204)
  unignoreComment(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @Param('commentId', new ZodPipe(workItemId)) commentId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.items.setCommentIgnored(projectId, id, commentId, false, user);
  }

  /** "Not really late": keeps the flags but leaves the late count. */
  @Put(':id/dismissal')
  @HttpCode(204)
  dismiss(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @Body(new ZodPipe(dismissDelayBody)) body: DismissDelayBody,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.items.setDismissal(projectId, id, body.reason, user);
  }

  @Delete(':id/dismissal')
  @HttpCode(204)
  undismiss(
    @Param('projectId') projectId: string,
    @Param('id', new ZodPipe(workItemId)) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.items.setDismissal(projectId, id, null, user);
  }
}
