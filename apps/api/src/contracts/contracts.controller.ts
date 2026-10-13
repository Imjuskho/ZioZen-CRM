import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ContractsService } from './contracts.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('contracts') @UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly s: ContractsService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
