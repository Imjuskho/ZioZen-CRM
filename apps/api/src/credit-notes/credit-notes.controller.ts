import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApplyCreditNoteDto, CreateCreditNoteDto } from './dto/credit-note.dto.js';

@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
export class CreditNotesController {
  constructor(private readonly service: CreditNotesService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) { return this.service.findAll(req.user.userId); }

  @Get('customers/:customerId/balance')
  customerBalance(@Request() req: { user: { userId: string } }, @Param('customerId') customerId: string) { return this.service.customerBalance(req.user.userId, customerId); }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateCreditNoteDto) { return this.service.create(req.user.userId, dto); }

  @Post(':id/apply')
  apply(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: ApplyCreditNoteDto) { return this.service.apply(req.user.userId, id, dto); }

  @Post(':id/reverse')
  reverse(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.service.reverse(req.user.userId, id); }
}
