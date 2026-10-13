import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
@Controller('knowledge-base') @UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly s: KnowledgeBaseService) {}
  @Get() list(@Query('all') all?: string) { return this.s.list(all !== 'true'); }
  @Post() create(@Body() dto: any) { return this.s.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.s.update(id, dto); }
}
