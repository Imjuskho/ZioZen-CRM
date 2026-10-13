import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class CustomerNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, customerId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);

    return this.prisma.customerNote.findMany({
      where: { customerId },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, customerId: string, body: string) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);

    const note = await this.prisma.customerNote.create({
      data: { customerId, authorId: userId, body },
      include: { author: true },
    });

    await this.audit.log({
      action: 'customer.note.created',
      entityType: 'CustomerNote',
      entityId: note.id,
      departmentId: customer.departmentId,
      actorId: userId,
      metadata: { customerId },
    });

    return note;
  }
}
