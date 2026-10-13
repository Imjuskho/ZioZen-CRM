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
import { TicketsService } from './tickets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  CreateTicketDto,
  UpdateTicketDto,
  CreateTicketReplyDto,
} from './dto/ticket.dto.js';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.ticketsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.ticketsService.findOne(req.user.userId, id);
  }

  @Post()
  create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(req.user.userId, id, dto);
  }

  @Post(':id/replies')
  addReply(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CreateTicketReplyDto,
  ) {
    return this.ticketsService.addReply(req.user.userId, id, dto);
  }
}
