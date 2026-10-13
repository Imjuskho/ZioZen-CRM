import { Module } from '@nestjs/common';
import { TaskCommentsController } from './task-comments.controller.js';
import { TaskCommentsService } from './task-comments.service.js';
@Module({ controllers: [TaskCommentsController], providers: [TaskCommentsService] })
export class TaskCommentsModule {}
