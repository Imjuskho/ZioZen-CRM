import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { InvoiceItemsService } from './invoice-items.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('invoices/:invoiceId/items') @UseGuards(JwtAuthGuard)
export class InvoiceItemsController {
  constructor(private readonly s: InvoiceItemsService) {}
  @Get() list(@Request() req: { user: { userId: string } }, @Param('invoiceId') id: string) { return this.s.list(req.user.userId, id); }
  @Post() add(@Request() req: { user: { userId: string } }, @Param('invoiceId') id: string, @Body() dto: any) { return this.s.add(req.user.userId, id, dto); }
}
