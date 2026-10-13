import { Module } from '@nestjs/common';
import { RecurringInvoicesController } from './recurring-invoices.controller.js';
import { RecurringInvoicesService } from './recurring-invoices.service.js';
@Module({ controllers: [RecurringInvoicesController], providers: [RecurringInvoicesService] })
export class RecurringInvoicesModule {}
