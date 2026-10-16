import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateAppointmentDto, CreateGoalDto, CreateRecurringTaskDto, UpdateKeyResultDto } from './planning.dto.js';
import { PlanningService } from './planning.service.js';

@Controller('planning')
@UseGuards(JwtAuthGuard)
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}
  @Get('recurring-tasks') recurringTasks(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.planning.recurringTasks(req.user.userId, departmentId); }
  @Post('recurring-tasks') createRecurringTask(@Request() req: { user: { userId: string } }, @Body() dto: CreateRecurringTaskDto) { return this.planning.createRecurringTask(req.user.userId, dto); }
  @Get('goals') goals(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.planning.goals(req.user.userId, departmentId); }
  @Post('goals') createGoal(@Request() req: { user: { userId: string } }, @Body() dto: CreateGoalDto) { return this.planning.createGoal(req.user.userId, dto); }
  @Post('key-results/:id') updateKeyResult(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: UpdateKeyResultDto) { return this.planning.updateKeyResult(req.user.userId, id, dto); }
  @Get('appointments') appointments(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.planning.appointments(req.user.userId, departmentId); }
  @Post('appointments') createAppointment(@Request() req: { user: { userId: string } }, @Body() dto: CreateAppointmentDto) { return this.planning.createAppointment(req.user.userId, dto); }
}
