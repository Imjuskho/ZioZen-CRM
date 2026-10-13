import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('calendar') @UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly s: CalendarService) {}
  @Get() list(@Request() req: { user: { userId: string } }) { return this.s.list(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
