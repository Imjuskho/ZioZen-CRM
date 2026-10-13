import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { TaskCommentsService } from './task-comments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class TaskCommentsController {
  constructor(private readonly service: TaskCommentsService) {}
  @Get()
  list(@Request() req: { user: { userId: string } }, @Param('taskId') taskId: string) {
    return this.service.list(req.user.userId, taskId);
  }
  @Post()
  create(@Request() req: { user: { userId: string } }, @Param('taskId') taskId: string, @Body('body') body: string) {
    return this.service.create(req.user.userId, taskId, body);
  }
}
