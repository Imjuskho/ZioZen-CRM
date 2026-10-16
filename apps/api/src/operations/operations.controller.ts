import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OperationsService } from './operations.service.js';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('health')
  health() {
    return this.operations.health();
  }

  @Get('support/timeline')
  timeline(@Request() req: { user: { userId: string } }, @Query('limit') limit?: string) {
    return this.operations.tenantSupportTimeline(req.user.userId, Number(limit) || 40);
  }

  @Get('support/diagnostic-bundle')
  diagnosticBundle(@Request() req: { user: { userId: string } }) {
    return this.operations.diagnosticBundle(req.user.userId);
  }
}
