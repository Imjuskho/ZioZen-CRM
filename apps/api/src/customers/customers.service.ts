import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.customer.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, owner: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateCustomerDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const customer = await this.prisma.customer.create({
      data: { ...dto, ownerId: userId },
      include: { department: true, owner: true },
    });
    await this.audit.log({
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      departmentId: customer.departmentId,
      actorId: userId,
      metadata: { name: customer.name, email: customer.email },
    });
    return customer;
  }

  async timeline(userId: string, customerId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);
    const [projects, tasks, invoices, tickets, notes, signals] = await Promise.all([
      this.prisma.project.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, name: true, status: true, updatedAt: true } }),
      this.prisma.task.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, title: true, status: true, updatedAt: true } }),
      this.prisma.invoice.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, number: true, status: true, updatedAt: true } }),
      this.prisma.ticket.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, subject: true, status: true, updatedAt: true } }),
      this.prisma.customerNote.findMany({ where: { customerId }, select: { id: true, body: true, createdAt: true } }),
      this.prisma.operationalSignal.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, title: true, status: true, createdAt: true, severity: true } }),
    ]);
    return [
      ...projects.map((item) => ({ type: 'project', id: item.id, title: item.name, status: item.status, occurredAt: item.updatedAt })),
      ...tasks.map((item) => ({ type: 'task', id: item.id, title: item.title, status: item.status, occurredAt: item.updatedAt })),
      ...invoices.map((item) => ({ type: 'invoice', id: item.id, title: item.number, status: item.status, occurredAt: item.updatedAt })),
      ...tickets.map((item) => ({ type: 'ticket', id: item.id, title: item.subject, status: item.status, occurredAt: item.updatedAt })),
      ...notes.map((item) => ({ type: 'note', id: item.id, title: item.body, status: 'recorded', occurredAt: item.createdAt })),
      ...signals.map((item) => ({ type: 'signal', id: item.id, title: item.title, status: item.status, severity: item.severity, occurredAt: item.createdAt })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
}
