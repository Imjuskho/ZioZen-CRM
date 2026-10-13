import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { DataMigrationService } from './data-migration.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService, DataMigrationService],
  exports: [ReportsService, DataMigrationService],
})
export class ReportsModule {}
