import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class EstimatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.estimate.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: true, customer: true }, orderBy: { createdAt: 'desc' } });
  }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const estimate = await this.prisma.estimate.create({ data: dto, include: { department: true, customer: true } });
    await this.audit.log({ action: 'estimate.created', entityType: 'Estimate', entityId: estimate.id, departmentId: estimate.departmentId, actorId: userId, metadata: { number: estimate.number } });
    return estimate;
  }
  async convert(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const estimate = await this.prisma.estimate.findUnique({ where: { id } });
    if (!estimate) throw new NotFoundException('Estimate not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, estimate.departmentId);
    const invoice = await this.prisma.invoice.create({ data: { number: `INV-${estimate.number}`, amount: estimate.total, currency: estimate.currency, departmentId: estimate.departmentId, customerId: estimate.customerId, ownerId: userId, status: 'draft', notes: estimate.notes }, include: { department: true, customer: true } });
    await this.prisma.estimate.update({ where: { id }, data: { status: 'converted', convertedInvoiceId: invoice.id } });
    await this.audit.log({ action: 'estimate.converted', entityType: 'Estimate', entityId: id, departmentId: estimate.departmentId, actorId: userId, metadata: { invoiceId: invoice.id } });
    return { estimateId: id, invoice };
  }
}
