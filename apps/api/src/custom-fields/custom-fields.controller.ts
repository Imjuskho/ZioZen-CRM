import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  CreateCustomFieldDto,
  SetCustomFieldValueDto,
} from '../common/dto/extensibility.dto.js';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  list(@Query('entityType') entityType?: string) {
    return this.service.list(entityType);
  }

  @Post()
  create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.service.create(req.user.userId, dto);
  }

  @Post('values')
  setValue(
    @Request() req: { user: { userId: string } },
    @Body() dto: SetCustomFieldValueDto,
  ) {
    return this.service.setValue(req.user.userId, dto);
  }

  @Get('values')
  values(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.service.values(entityType, entityId);
  }
}
