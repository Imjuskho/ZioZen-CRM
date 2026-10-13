import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { MilestonesService } from './milestones.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('projects/:projectId/milestones') @UseGuards(JwtAuthGuard)
export class MilestonesController {
  constructor(private readonly s: MilestonesService) {}
  @Get() list(@Request() req: { user: { userId: string } }, @Param('projectId') projectId: string) { return this.s.list(req.user.userId, projectId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() dto: any) { return this.s.create(req.user.userId, projectId, dto); }
  @Patch(':id') complete(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('completed') completed: boolean) { return this.s.complete(req.user.userId, id, completed); }
}
