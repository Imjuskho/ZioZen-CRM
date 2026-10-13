import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateWebhookDto } from '../common/dto/extensibility.dto.js';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.webhooksService.findAll(req.user.userId);
  }

  @Post()
  create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(req.user.userId, dto);
  }
}
