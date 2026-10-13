import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('webhooks') @UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly s: WebhooksService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
