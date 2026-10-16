import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { AccountingModule } from '../accounting/accounting.module.js';

@Module({
  controllers: [InvoicesController],
  imports: [AccountingModule],
  providers: [InvoicesService],
})
export class InvoicesModule {}
