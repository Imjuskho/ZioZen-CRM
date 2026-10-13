import { Controller, Get, Param, Request, Res, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { Response } from 'express';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('invoices/:id')
  async invoice(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Res() response: Response) {
    const html = await this.documentsService.renderInvoice(req.user.userId, id);
    response.type('text/html').send(html);
  }
}
