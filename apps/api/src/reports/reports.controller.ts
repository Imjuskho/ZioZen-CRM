import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('department-summary')
  summary(@Request() req: { user: { userId: string } }) {
    return this.reportsService.departmentSummary(req.user.userId);
  }
}
