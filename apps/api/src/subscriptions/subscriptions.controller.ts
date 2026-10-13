import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('subscriptions') @UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly s: SubscriptionsService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
