import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CustomerPortalController } from './customer-portal.controller.js';
import { CustomerPortalGuard } from './customer-portal.guard.js';
import { CustomerPortalService } from './customer-portal.service.js';

@Module({
  imports: [PrismaModule, AuditModule, JwtModule.register({})],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService, CustomerPortalGuard],
})
export class CustomerPortalModule {}
