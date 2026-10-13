import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './leads.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateLeadDto, UpdateLeadDto, ConvertLeadDto } from './dto/lead.dto.js';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.leadsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.leadsService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(req.user.userId, id, dto);
  }

  @Post(':id/convert')
  convert(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(req.user.userId, id, dto);
  }
}
