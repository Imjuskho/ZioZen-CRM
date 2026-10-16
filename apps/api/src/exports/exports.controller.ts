import { Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { Permissions } from '../common/permissions.decorator.js';
import { ExportsService } from './exports.service.js';

@Controller('exports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Permissions('export.read')
  @Get('tenant')
  tenant(@Request() req: { user: { userId: string } }, @Query('includeAudit') includeAudit = 'true') {
    return this.exportsService.tenantExport(req.user.userId, includeAudit !== 'false');
  }

  @Permissions('export.read')
  @Post('tenant/jobs')
  createJob(@Request() req: { user: { userId: string } }, @Query('includeAudit') includeAudit = 'true') {
    return this.exportsService.createTenantExportJob(req.user.userId, includeAudit !== 'false');
  }

  @Permissions('export.read')
  @Get('tenant/jobs')
  listJobs(@Request() req: { user: { userId: string } }) {
    return this.exportsService.listTenantExportJobs(req.user.userId);
  }

  @Permissions('export.read')
  @Get('tenant/jobs/:id')
  getJob(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.exportsService.getTenantExportJob(req.user.userId, id);
  }

  @Permissions('export.read')
  @Get('tenant/jobs/:id/download')
  downloadJob(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.exportsService.downloadTenantExportJob(req.user.userId, id);
  }
}
