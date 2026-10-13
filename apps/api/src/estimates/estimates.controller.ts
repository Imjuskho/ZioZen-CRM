import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { EstimatesService } from './estimates.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('estimates') @UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(private readonly s: EstimatesService) {}
  @Get() findAll(@Request() req: { user: { userId: string } }) { return this.s.findAll(req.user.userId); }
  @Post() create(@Request() req: { user: { userId: string } }, @Body() dto: any) { return this.s.create(req.user.userId, dto); }
  @Post(':id/convert') convert(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.s.convert(req.user.userId, id); }
}
