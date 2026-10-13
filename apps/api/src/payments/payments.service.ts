import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(userId: string, invoiceId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);
    return this.prisma.payment.findMany({ where: { invoiceId }, orderBy: { paymentDate: 'desc' } });
  }

  async create(userId: string, invoiceId: string, dto: { amount: string; method?: string; transactionId?: string; notes?: string }) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);

    const payment = await this.prisma.payment.create({
      data: { invoiceId, amount: dto.amount, method: dto.method, transactionId: dto.transactionId, notes: dto.notes },
    });

    await this.audit.log({
      action: 'invoice.payment.created',
      entityType: 'Payment',
      entityId: payment.id,
      departmentId: invoice.departmentId,
      actorId: userId,
      metadata: { invoiceId, amount: dto.amount },
    });

    return payment;
  }
}
