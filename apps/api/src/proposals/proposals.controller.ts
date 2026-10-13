import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ProposalsService } from './proposals.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('proposals') @UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(private readonly s: ProposalsService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
  @Post(':id/accept') accept(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.s.accept(req.user.userId, id); }
}
