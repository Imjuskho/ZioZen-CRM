import { Module } from '@nestjs/common';
import { InvoiceItemsController } from './invoice-items.controller.js';
import { InvoiceItemsService } from './invoice-items.service.js';
@Module({ controllers: [InvoiceItemsController], providers: [InvoiceItemsService] })
export class InvoiceItemsModule {}
