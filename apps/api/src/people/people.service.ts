import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApprovalDto, CreateEmployeeDto, CreateLeaveDto, CreatePayrollDto, DecideApprovalDto, DecideLeaveDto } from './people.dto.js';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async employees(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.employeeProfile.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true, active: true } }, department: true }, orderBy: [{ departmentId: 'asc' }, { createdAt: 'desc' }] });
  }

  async createEmployee(userId: string, dto: CreateEmployeeDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.employeeProfile.findUnique({ where: { userId: dto.userId } });
    if (existing) throw new ConflictException('User already has an employee profile');
    const profile = await this.prisma.employeeProfile.create({ data: { userId: dto.userId, departmentId: dto.departmentId, jobTitle: dto.jobTitle.trim(), employmentType: dto.employmentType ?? 'full_time', hourlyRate: dto.hourlyRate ? new Prisma.Decimal(dto.hourlyRate) : undefined, salary: dto.salary ? new Prisma.Decimal(dto.salary) : undefined, startDate: new Date(dto.startDate) }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } });
    await this.audit.log({ action: 'EMPLOYEE_PROFILE_CREATED', entityType: 'EmployeeProfile', entityId: profile.id, departmentId: dto.departmentId, actorId: userId, metadata: { userId: dto.userId, jobTitle: dto.jobTitle } });
    return profile;
  }

  async leaves(userId: string, departmentId?: string, status?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.leaveRequest.findMany({ where: { ...(departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }), ...(status ? { status } : {}) }, include: { employee: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }, orderBy: { createdAt: 'desc' } });
  }

  async createLeave(userId: string, dto: CreateLeaveDto) {
    const scope = await getUserScope(this.prisma, userId);
    const employee = await this.prisma.employeeProfile.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, employee.departmentId);
    const startDate = new Date(dto.startDate); const endDate = new Date(dto.endDate);
    if (startDate >= endDate) throw new BadRequestException('Leave end date must be after start date');
    const overlap = await this.prisma.leaveRequest.findFirst({ where: { employeeId: employee.id, status: { in: ['pending', 'approved'] }, startDate: { lt: endDate }, endDate: { gt: startDate } } });
    if (overlap) throw new ConflictException('Leave overlaps an existing request');
    const leave = await this.prisma.leaveRequest.create({ data: { employeeId: employee.id, departmentId: employee.departmentId, type: dto.type, startDate, endDate, reason: dto.reason } });
    await this.audit.log({ action: 'LEAVE_REQUEST_CREATED', entityType: 'LeaveRequest', entityId: leave.id, departmentId: employee.departmentId, actorId: userId, metadata: { type: dto.type, startDate, endDate } });
    return leave;
  }

  async decideLeave(userId: string, leaveId: string, dto: DecideLeaveDto) {
    const scope = await getUserScope(this.prisma, userId);
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, leave.departmentId);
    if (!scope.isAdmin && !['MANAGER'].includes(scope.user.role)) throw new ConflictException('Only managers can decide leave requests');
    if (leave.status !== 'pending') throw new ConflictException('Leave request has already been decided');
    const updated = await this.prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: dto.status, decidedById: userId, decidedAt: new Date(), decisionNote: dto.note } });
    await this.audit.log({ action: `LEAVE_REQUEST_${dto.status.toUpperCase()}`, entityType: 'LeaveRequest', entityId: leave.id, departmentId: leave.departmentId, actorId: userId, metadata: { note: dto.note } });
    return updated;
  }

  async approvals(userId: string, departmentId?: string, status?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.approvalRequest.findMany({ where: { ...(departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }), ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async createApproval(userId: string, dto: CreateApprovalDto & { departmentId: string }) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const approval = await this.prisma.approvalRequest.create({ data: { entityType: dto.entityType, entityId: dto.entityId, requestedById: userId, requiredRole: dto.requiredRole, stepOrder: dto.stepOrder ?? 1, departmentId: dto.departmentId } });
    await this.audit.log({ action: 'APPROVAL_REQUEST_CREATED', entityType: 'ApprovalRequest', entityId: approval.id, departmentId: dto.departmentId, actorId: userId, metadata: { target: `${dto.entityType}:${dto.entityId}`, stepOrder: approval.stepOrder } });
    return approval;
  }

  async decideApproval(userId: string, id: string, dto: DecideApprovalDto) {
    const scope = await getUserScope(this.prisma, userId); const approval = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException('Approval request not found'); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, approval.departmentId);
    if (approval.status !== 'pending') throw new ConflictException('Approval request has already been decided');
    if (!scope.isAdmin && approval.requiredRole && scope.user.role !== approval.requiredRole) throw new ConflictException(`Approval requires role ${approval.requiredRole}`);
    const updated = await this.prisma.approvalRequest.update({ where: { id }, data: { status: dto.status, approvedById: userId, decidedAt: new Date(), decisionNote: dto.note } });
    await this.audit.log({ action: `APPROVAL_REQUEST_${dto.status.toUpperCase()}`, entityType: 'ApprovalRequest', entityId: id, departmentId: approval.departmentId, actorId: userId, metadata: { note: dto.note } });
    return updated;
  }

  async payroll(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.payrollBatch.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { payslips: { include: { employee: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } } } }, orderBy: { createdAt: 'desc' } });
  }

  async validatePayroll(userId: string, batchId: string) {
    const batch = await this.getPayrollForAccess(userId, batchId);
    const errors: string[] = [];
    if (!batch.payslips.length) errors.push('Payroll batch has no payslips');
    for (const payslip of batch.payslips) {
      if (!payslip.employee.user.active) errors.push(`${payslip.employee.user.email} is inactive`);
      if (payslip.netAmount.lt(0)) errors.push(`${payslip.employee.user.email} has a negative net amount`);
    }
    return { batchId, status: batch.status, ready: errors.length === 0, errors, totals: { employees: batch.payslips.length, gross: batch.payslips.reduce((sum, line) => sum.add(line.grossAmount), new Prisma.Decimal(0)).toString(), deductions: batch.payslips.reduce((sum, line) => sum.add(line.deductionAmount), new Prisma.Decimal(0)).toString(), net: batch.payslips.reduce((sum, line) => sum.add(line.netAmount), new Prisma.Decimal(0)).toString() } };
  }

  async approvePayroll(userId: string, batchId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin && !['MANAGER', 'ADMIN'].includes(scope.user.role)) throw new ConflictException('Only managers can approve payroll');
    const batch = await this.getPayrollForAccess(userId, batchId);
    if (batch.createdById === userId) throw new ConflictException('Payroll approval requires a different approver from the batch creator');
    if (batch.status !== 'draft') throw new ConflictException('Only draft payroll batches can be approved');
    const validation = await this.validatePayroll(userId, batchId);
    if (!validation.ready) throw new ConflictException({ message: 'Payroll validation failed', validation });
    const approved = await this.prisma.payrollBatch.update({ where: { id: batchId }, data: { status: 'approved', approvedById: userId, approvedAt: new Date() } });
    await this.audit.log({ action: 'PAYROLL_BATCH_APPROVED', entityType: 'PayrollBatch', entityId: batchId, departmentId: batch.departmentId, actorId: userId, metadata: { totals: validation.totals } });
    return approved;
  }

  async exportPayroll(userId: string, batchId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin && !['MANAGER', 'ADMIN'].includes(scope.user.role)) throw new ConflictException('Only managers can export payroll');
    const batch = await this.getPayrollForAccess(userId, batchId);
    if (batch.status !== 'approved') throw new ConflictException('Payroll batch must be approved before export');
    const reference = `PAYROLL-${batch.id}-${Date.now()}`;
    const header = 'employee_id,email,period_start,period_end,gross,bonus,deductions,net';
    const rows = batch.payslips.map((line) => [line.employeeId, line.employee.user.email, line.periodStart.toISOString().slice(0, 10), line.periodEnd.toISOString().slice(0, 10), line.grossAmount.toString(), line.bonusAmount.toString(), line.deductionAmount.toString(), line.netAmount.toString()].join(','));
    const exported = await this.prisma.payrollBatch.update({ where: { id: batchId }, data: { status: 'exported', lockedAt: new Date(), exportedAt: new Date(), exportReference: reference } });
    await this.audit.log({ action: 'PAYROLL_BATCH_EXPORTED', entityType: 'PayrollBatch', entityId: batchId, departmentId: batch.departmentId, actorId: userId, metadata: { reference, lineCount: rows.length, operationalExport: true } });
    return { batch: exported, reference, format: 'csv', operationalOnly: true, content: [header, ...rows].join('\n') };
  }

  private async getPayrollForAccess(userId: string, batchId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const batch = await this.prisma.payrollBatch.findUnique({ where: { id: batchId }, include: { payslips: { include: { employee: { include: { user: { select: { email: true, active: true } } } } } } } });
    if (!batch) throw new NotFoundException('Payroll batch not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, batch.departmentId);
    return batch;
  }

  async createPayroll(userId: string, dto: CreatePayrollDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const start = new Date(dto.periodStart); const end = new Date(dto.periodEnd); if (start >= end) throw new BadRequestException('Payroll period end date must be after start date');
    if (!dto.lines.length) throw new BadRequestException('Payroll batch requires at least one employee');
    const employees = await this.prisma.employeeProfile.findMany({ where: { id: { in: dto.lines.map((line) => line.employeeId) }, departmentId: dto.departmentId } });
    if (employees.length !== new Set(dto.lines.map((line) => line.employeeId)).size) throw new BadRequestException('All payroll employees must belong to the department');
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const batch = await this.prisma.payrollBatch.create({ data: { name: dto.name.trim(), periodStart: start, periodEnd: end, departmentId: dto.departmentId, createdById: userId, payslips: { create: dto.lines.map((line) => { const employee = employeeById.get(line.employeeId)!; const gross = employee.salary ?? (employee.hourlyRate ? employee.hourlyRate.mul(new Prisma.Decimal(line.hours ?? '0')) : new Prisma.Decimal(0)); const bonus = new Prisma.Decimal(line.bonus ?? '0'); const deductions = new Prisma.Decimal(line.deductions ?? '0'); if (bonus.lt(0) || deductions.lt(0) || gross.lt(0) || deductions.gt(gross.add(bonus))) throw new BadRequestException('Invalid payroll amount'); return { employeeId: employee.id, periodStart: start, periodEnd: end, grossAmount: gross, bonusAmount: bonus, deductionAmount: deductions, netAmount: gross.add(bonus).sub(deductions) }; }) } }, include: { payslips: true } });
    await this.audit.log({ action: 'PAYROLL_BATCH_CREATED', entityType: 'PayrollBatch', entityId: batch.id, departmentId: dto.departmentId, actorId: userId, metadata: { lineCount: dto.lines.length, periodStart: start, periodEnd: end } });
    return batch;
  }
}
