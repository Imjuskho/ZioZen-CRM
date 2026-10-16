import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateApprovalDto, CreateEmployeeDto, CreateLeaveDto, CreatePayrollDto, DecideApprovalDto, DecideLeaveDto } from './people.dto.js';
import { PeopleService } from './people.service.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { Permissions } from '../common/permissions.decorator.js';

@Controller('people')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Permissions('people.read')
  @Get('employees') employees(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.people.employees(req.user.userId, departmentId); }
  @Permissions('people.manage')
  @Post('employees') createEmployee(@Request() req: { user: { userId: string } }, @Body() dto: CreateEmployeeDto) { return this.people.createEmployee(req.user.userId, dto); }
  @Permissions('people.read')
  @Get('leave-requests') leaves(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string, @Query('status') status?: string) { return this.people.leaves(req.user.userId, departmentId, status); }
  @Permissions('people.manage')
  @Post('leave-requests') createLeave(@Request() req: { user: { userId: string } }, @Body() dto: CreateLeaveDto) { return this.people.createLeave(req.user.userId, dto); }
  @Permissions('people.manage')
  @Post('leave-requests/:id/decision') decideLeave(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: DecideLeaveDto) { return this.people.decideLeave(req.user.userId, id, dto); }
  @Permissions('people.read')
  @Get('approvals') approvals(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string, @Query('status') status?: string) { return this.people.approvals(req.user.userId, departmentId, status); }
  @Permissions('people.manage')
  @Post('approvals') createApproval(@Request() req: { user: { userId: string } }, @Body() dto: CreateApprovalDto & { departmentId: string }) { return this.people.createApproval(req.user.userId, dto); }
  @Permissions('people.manage')
  @Post('approvals/:id/decision') decideApproval(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: DecideApprovalDto) { return this.people.decideApproval(req.user.userId, id, dto); }
  @Permissions('people.read')
  @Get('payroll') payroll(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.people.payroll(req.user.userId, departmentId); }
  @Permissions('people.payroll')
  @Post('payroll') createPayroll(@Request() req: { user: { userId: string } }, @Body() dto: CreatePayrollDto) { return this.people.createPayroll(req.user.userId, dto); }
  @Permissions('people.read')
  @Get('payroll/:id/validation') validatePayroll(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.people.validatePayroll(req.user.userId, id); }
  @Permissions('people.payroll')
  @Post('payroll/:id/approve') approvePayroll(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.people.approvePayroll(req.user.userId, id); }
  @Permissions('people.payroll')
  @Post('payroll/:id/export') exportPayroll(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.people.exportPayroll(req.user.userId, id); }
}
