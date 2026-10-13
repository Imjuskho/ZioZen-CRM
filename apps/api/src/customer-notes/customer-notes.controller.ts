import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CustomerNotesService } from './customer-notes.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('customers/:customerId/notes')
@UseGuards(JwtAuthGuard)
export class CustomerNotesController {
  constructor(private readonly service: CustomerNotesService) {}

  @Get()
  list(@Request() req: { user: { userId: string } }, @Param('customerId') customerId: string) {
    return this.service.list(req.user.userId, customerId);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Param('customerId') customerId: string, @Body() dto: CreateNoteDto) {
    return this.service.create(req.user.userId, customerId, dto.body);
  }
}
