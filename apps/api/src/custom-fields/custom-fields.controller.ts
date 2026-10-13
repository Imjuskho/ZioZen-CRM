import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}
  @Get() list(@Query('entityType') entityType?: string) { return this.service.list(entityType); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Post('values') value(@Body() dto: any) { return this.service.setValue(dto.customFieldId, dto.entityType, dto.entityId, dto.value); }
  @Get('values') values(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.service.values(entityType, entityId);
  }
}
