import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PlanningController } from './planning.controller.js';
import { PlanningService } from './planning.service.js';

@Module({ imports: [PrismaModule, AuditModule], controllers: [PlanningController], providers: [PlanningService], exports: [PlanningService] })
export class PlanningModule {}
