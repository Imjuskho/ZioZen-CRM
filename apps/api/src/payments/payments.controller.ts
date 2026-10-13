import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('invoices/:invoiceId/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  list(@Request() req: { user: { userId: string } }, @Param('invoiceId') invoiceId: string) {
    return this.service.list(req.user.userId, invoiceId);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Param('invoiceId') invoiceId: string, @Body() dto: CreatePaymentDto) {
    return this.service.create(req.user.userId, invoiceId, dto);
  }
}
