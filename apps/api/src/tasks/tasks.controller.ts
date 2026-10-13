import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.tasksService.findAll(req.user.userId);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user.userId, dto);
  }

  @Put(':id/status')
  updateStatus(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('status') status: string) {
    return this.tasksService.updateStatus(req.user.userId, id, status);
  }
}
