import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('expenses') @UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly s: ExpensesService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.s.findAll(req.user.userId, departmentId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
}
