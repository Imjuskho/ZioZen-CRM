import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { AccountingModule } from '../accounting/accounting.module.js';
@Module({ imports: [AccountingModule], controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
