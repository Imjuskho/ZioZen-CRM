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
import { ContractsService } from './contracts.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto.js';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.contractsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.contractsService.findOne(req.user.userId, id);
  }

  @Post()
  create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateContractDto,
  ) {
    return this.contractsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.update(req.user.userId, id, dto);
  }
}
