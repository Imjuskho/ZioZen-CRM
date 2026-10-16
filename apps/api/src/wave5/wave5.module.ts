import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AutomationService } from './automation.service.js';
import { InboxService } from './inbox.service.js';
import { Wave5Controller } from './wave5.controller.js';

@Module({ imports: [PrismaModule, AuditModule, AuthModule], controllers: [Wave5Controller], providers: [AutomationService, InboxService], exports: [AutomationService, InboxService] })
export class Wave5Module {}
