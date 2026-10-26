import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createTaskBody,
  createTaskCommentBody,
  type CreateTaskCommentBody,
  type TaskComment,
  guid,
  taskListQuery,
  taskSummaryQuery,
  updateTaskBody,
  type CreateTaskBody,
  type Paged,
  type Task,
  type TaskListQuery,
  type TaskSummary,
  type TaskSummaryQuery,
  type UpdateTaskBody,
} from '@ado-metrics/shared';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Query(new ZodPipe(taskListQuery)) q: TaskListQuery,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<Paged<Task>> {
    return this.tasks.list(q, user, req);
  }

  @Get('summary')
  summary(
    @Query(new ZodPipe(taskSummaryQuery)) q: TaskSummaryQuery,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<TaskSummary> {
    return this.tasks.summary(q.weeks, user, req);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodPipe(createTaskBody)) body: CreateTaskBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<Task> {
    return this.tasks.create(body, user, req);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodPipe(guid)) id: string,
    @Body(new ZodPipe(updateTaskBody)) body: UpdateTaskBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<Task> {
    return this.tasks.update(id, body, user, req);
  }

  @Get(':id/comments')
  comments(
    @Param('id', new ZodPipe(guid)) id: string,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<TaskComment[]> {
    return this.tasks.comments(id, user, req);
  }

  @Post(':id/comments')
  @HttpCode(201)
  addComment(
    @Param('id', new ZodPipe(guid)) id: string,
    @Body(new ZodPipe(createTaskCommentBody)) body: CreateTaskCommentBody,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<TaskComment> {
    return this.tasks.addComment(id, body.body, user, req);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', new ZodPipe(guid)) id: string,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.tasks.remove(id, user, req);
  }
}
