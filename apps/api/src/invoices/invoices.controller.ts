import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.invoicesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.invoicesService.findOne(req.user.userId, id);
  }

  @Get(':id/html')
  async previewHtml(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.invoicesService.getHtml(req.user.userId, id);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(req.user.userId, dto);
  }
}
