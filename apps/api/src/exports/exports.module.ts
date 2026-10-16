import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({ imports: [PrismaModule, AuditModule], controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
