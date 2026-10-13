import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EstimatesService } from './estimates.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateEstimateDto } from './dto/estimate.dto.js';

@Controller('estimates')
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.estimatesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.estimatesService.findOne(req.user.userId, id);
  }

  @Post()
  create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateEstimateDto,
  ) {
    return this.estimatesService.create(req.user.userId, dto);
  }

  @Post(':id/convert')
  convert(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.estimatesService.convert(req.user.userId, id);
  }
}
