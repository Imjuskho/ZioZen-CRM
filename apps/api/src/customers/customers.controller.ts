import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.customersService.findAll(req.user.userId);
  }

  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.userId, dto);
  }

  @Get(':id/timeline')
  timeline(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.customersService.timeline(req.user.userId, id);
  }
}
