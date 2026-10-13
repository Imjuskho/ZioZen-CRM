import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('announcements') @UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly s: AnnouncementsService) {}
  @Get() list() { return this.s.list(); }
  @Post() create(@Body() dto: any) { return this.s.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.s.update(id, dto); }
}
