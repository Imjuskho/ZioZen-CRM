import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller.js';
import { AccountingService } from './accounting.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({ controllers: [AccountingController], providers: [AccountingService, ReconciliationService], exports: [AccountingService] })
export class AccountingModule {}
