import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.departmentsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.departmentsService.findOne(req.user.userId, id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(req.user.userId, dto);
  }

  @Roles('ADMIN')
  @Put(':id')
  update(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>) {
    return this.departmentsService.update(req.user.userId, id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.departmentsService.remove(req.user.userId, id);
  }
}
