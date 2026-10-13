import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly service: TicketsService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.service.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.service.create(req.user.userId, dto); }
  @Patch(':id') update(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: any) { return this.service.update(req.user.userId, id, dto); }
}
