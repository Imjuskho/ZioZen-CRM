import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('customers/:customerId/contacts') @UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly s: ContactsService) {}
  @Get() list(@Request() req: { user: { userId: string } }, @Param('customerId') id: string) { return this.s.list(req.user.userId, id); }
  @Post() create(@Request() req: { user: { userId: string } }, @Param('customerId') id: string, @Body() dto: any) { return this.s.create(req.user.userId, id, dto); }
}
