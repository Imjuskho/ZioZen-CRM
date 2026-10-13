import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('credit-notes') @UseGuards(JwtAuthGuard)
export class CreditNotesController {
  constructor(private readonly s: CreditNotesService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
