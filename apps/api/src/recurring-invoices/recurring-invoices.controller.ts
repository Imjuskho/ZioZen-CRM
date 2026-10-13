import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { RecurringInvoicesService } from './recurring-invoices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('recurring-invoices') @UseGuards(JwtAuthGuard)
export class RecurringInvoicesController {
  constructor(private readonly s: RecurringInvoicesService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
  @Patch(':id') update(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: any) { return this.s.update(req.user.userId, id, dto); }
}
