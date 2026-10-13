import { Module } from '@nestjs/common';
import { CustomerNotesController } from './customer-notes.controller.js';
import { CustomerNotesService } from './customer-notes.service.js';

@Module({
  controllers: [CustomerNotesController],
  providers: [CustomerNotesService],
})
export class CustomerNotesModule {}
