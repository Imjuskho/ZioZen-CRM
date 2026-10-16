import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SignalsService } from './signals.service.js';

@Controller('signals')
@UseGuards(JwtAuthGuard)
export class SignalsController {
  constructor(private readonly signals: SignalsService) {}

  @Get('metrics/summary')
  metrics(@Request() req: { user: { userId: string } }) { return this.signals.metrics(req.user.userId); }

  @Get('rules/list')
  rules(@Request() req: { user: { userId: string } }) { return this.signals.rules(req.user.userId); }

  @Post('rules/:type')
  saveRule(@Request() req: { user: { userId: string } }, @Param('type') type: string, @Body() body: { departmentId: string; enabled?: boolean; thresholdHours?: number; cooldownHours?: number }) { return this.signals.saveRule(req.user.userId, type, body); }

  @Get()
  findAll(@Request() req: { user: { userId: string } }, @Query('status') status?: string) { return this.signals.findAll(req.user.userId, status); }

  @Get(':id/evidence')
  evidence(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.signals.evidence(req.user.userId, id); }

  @Post(':id/resolve')
  resolve(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('reason') reason?: string) { return this.signals.transition(req.user.userId, id, 'resolved', reason); }

  @Post(':id/dismiss')
  dismiss(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('reason') reason?: string) { return this.signals.transition(req.user.userId, id, 'dismissed', reason); }

  @Post(':id/snooze')
  snooze(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('until') until?: string) { return this.signals.snooze(req.user.userId, id, until); }

  @Post(':id/reassign')
  reassign(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body('ownerId') ownerId: string) { return this.signals.reassign(req.user.userId, id, ownerId); }
}
