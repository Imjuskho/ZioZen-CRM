import { Module } from '@nestjs/common';
import { CreditNotesController } from './credit-notes.controller.js';
import { CreditNotesService } from './credit-notes.service.js';
import { AccountingModule } from '../accounting/accounting.module.js';
@Module({ imports: [AccountingModule], controllers: [CreditNotesController], providers: [CreditNotesService] })
export class CreditNotesModule {}
