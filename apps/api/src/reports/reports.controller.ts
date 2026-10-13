import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { DataMigrationService } from './data-migration.service.js';
import type { ExportScope } from './data-migration.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly migrationService: DataMigrationService,
  ) {}

  @Get('department-summary')
  summary(
    @Request() req: { user: { userId: string } },
    @Query('departmentId') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.departmentSummary(req.user.userId, {
      departmentId,
      from,
      to,
    });
  }

  @Get('export')
  exportData(
    @Request() req: { user: { userId: string } },
    @Query('entity') entity: ExportScope,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.migrationService.exportData(req.user.userId, entity, departmentId);
  }

  @Post('import')
  importData(
    @Request() req: { user: { userId: string } },
    @Body() body: { entity: ExportScope; departmentId: string; records: any[] },
  ) {
    return this.migrationService.importData(
      req.user.userId,
      body.entity,
      body.departmentId,
      body.records,
    );
  }
}
