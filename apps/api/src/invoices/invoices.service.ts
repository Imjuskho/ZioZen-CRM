import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.invoice.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateInvoiceDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    const invoice = await this.prisma.invoice.create({
      data: {
        number: dto.number,
        amount: dto.amount,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        status: dto.status ?? 'draft',
        currency: dto.currency ?? 'USD',
        notes: dto.notes,
        ownerId: userId,
      },
      include: { department: true, customer: true },
    });

    await this.audit.log({
      action: 'invoice.created',
      entityType: 'Invoice',
      entityId: invoice.id,
      departmentId: invoice.departmentId,
      actorId: userId,
      metadata: { number: invoice.number, amount: invoice.amount.toString() },
    });

    return invoice;
  }
}
