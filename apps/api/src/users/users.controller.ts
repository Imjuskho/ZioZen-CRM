import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { MembershipDto } from './dto/membership.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN')
  @Get()
  findAll(@Request() req: { user: { userId: string } }) {
    return this.usersService.findAll(req.user.userId);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/memberships')
  addMembership(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: MembershipDto) {
    return this.usersService.addMembership(req.user.userId, id, dto.departmentId, dto.isPrimary);
  }

  @Roles('ADMIN')
  @Delete(':id/memberships/:departmentId')
  removeMembership(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Param('departmentId') departmentId: string) {
    return this.usersService.removeMembership(req.user.userId, id, departmentId);
  }
}
