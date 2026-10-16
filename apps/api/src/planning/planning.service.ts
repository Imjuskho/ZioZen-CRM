import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAppointmentDto, CreateGoalDto, CreateRecurringTaskDto, UpdateKeyResultDto } from './planning.dto.js';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async recurringTasks(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.recurringTask.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, orderBy: { nextRunAt: 'asc' } });
  }

  async createRecurringTask(userId: string, dto: CreateRecurringTaskDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const nextRunAt = new Date(dto.nextRunAt); if (Number.isNaN(nextRunAt.getTime())) throw new BadRequestException('Invalid next run date');
    if (dto.assigneeId) await this.assertMember(dto.assigneeId, dto.departmentId);
    const task = await this.prisma.recurringTask.create({ data: { departmentId: dto.departmentId, title: dto.title.trim(), description: dto.description, frequency: dto.frequency, nextRunAt, assigneeId: dto.assigneeId, createdById: userId } });
    await this.audit.log({ action: 'RECURRING_TASK_CREATED', entityType: 'RecurringTask', entityId: task.id, departmentId: dto.departmentId, actorId: userId, metadata: { frequency: dto.frequency } }); return task;
  }

  async goals(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.goal.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { keyResults: true, owner: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { periodEnd: 'asc' } });
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const start = new Date(dto.periodStart); const end = new Date(dto.periodEnd); if (start >= end) throw new BadRequestException('Goal period end must be after start');
    if (!dto.keyResults.length) throw new BadRequestException('An OKR requires at least one key result');
    if (dto.ownerId) await this.assertMember(dto.ownerId, dto.departmentId);
    const goal = await this.prisma.goal.create({ data: { departmentId: dto.departmentId, title: dto.title.trim(), description: dto.description, periodStart: start, periodEnd: end, ownerId: dto.ownerId, keyResults: { create: dto.keyResults.map((result) => ({ title: result.title.trim(), target: new Prisma.Decimal(result.target), current: new Prisma.Decimal(result.current ?? '0'), unit: result.unit ?? 'count' })) } }, include: { keyResults: true } });
    await this.audit.log({ action: 'OKR_CREATED', entityType: 'Goal', entityId: goal.id, departmentId: dto.departmentId, actorId: userId, metadata: { keyResultCount: dto.keyResults.length } }); return goal;
  }

  async updateKeyResult(userId: string, id: string, dto: UpdateKeyResultDto) {
    const scope = await getUserScope(this.prisma, userId); const keyResult = await this.prisma.keyResult.findUnique({ where: { id }, include: { goal: true } });
    if (!keyResult) throw new NotFoundException('Key result not found'); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, keyResult.goal.departmentId);
    const current = new Prisma.Decimal(dto.current); if (current.lt(0)) throw new BadRequestException('Progress cannot be negative');
    const status = dto.status ?? (current.gte(keyResult.target) ? 'completed' : current.gt(0) ? 'on_track' : 'not_started');
    const updated = await this.prisma.keyResult.update({ where: { id }, data: { current, status } });
    await this.audit.log({ action: 'KEY_RESULT_UPDATED', entityType: 'KeyResult', entityId: id, departmentId: keyResult.goal.departmentId, actorId: userId, metadata: { current: current.toString(), status } }); return updated;
  }

  async appointments(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.appointment.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { customer: { select: { id: true, name: true } }, owner: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { startsAt: 'asc' } });
  }

  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const start = new Date(dto.startsAt); const end = new Date(dto.endsAt); if (start >= end) throw new BadRequestException('Appointment end must be after start');
    const ownerId = dto.ownerId ?? userId; await this.assertMember(ownerId, dto.departmentId);
    if (dto.customerId) { const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, departmentId: dto.departmentId } }); if (!customer) throw new NotFoundException('Customer not found in department'); }
    const overlap = await this.prisma.appointment.findFirst({ where: { ownerId, status: 'scheduled', startsAt: { lt: end }, endsAt: { gt: start } } }); if (overlap) throw new ConflictException('Appointment overlaps an existing appointment for this owner');
    const appointment = await this.prisma.appointment.create({ data: { departmentId: dto.departmentId, ownerId, customerId: dto.customerId, title: dto.title.trim(), description: dto.description, location: dto.location, startsAt: start, endsAt: end }, include: { customer: true } });
    await this.audit.log({ action: 'APPOINTMENT_CREATED', entityType: 'Appointment', entityId: appointment.id, departmentId: dto.departmentId, actorId: userId, metadata: { ownerId, startsAt: start, endsAt: end } }); return appointment;
  }

  private async assertMember(userId: string, departmentId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { memberships: true } }); if (!user || !user.active || (user.role !== 'ADMIN' && !user.memberships.some((membership) => membership.departmentId === departmentId))) throw new BadRequestException('User must be active in the department'); }
}
