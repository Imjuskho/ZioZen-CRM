import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { AccountingService } from '../accounting/accounting.service.js';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accounting: AccountingService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.invoice.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, customer: true, payments: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { department: true, customer: true, payments: true, items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);

    const paidTotal = invoice.payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0),
    );
    const outstandingBalance = invoice.amount.minus(paidTotal);

    return {
      ...invoice,
      paidTotal: paidTotal.toString(),
      outstandingBalance: outstandingBalance.toString(),
    };
  }

  async create(userId: string, dto: CreateInvoiceDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
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
        include: { department: true, customer: true, payments: true, items: true },
      });

      await this.audit.log({
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: invoice.id,
        departmentId: invoice.departmentId,
        actorId: userId,
        metadata: { number: invoice.number, amount: invoice.amount.toString(), status: invoice.status },
      }, tx);
      if (invoice.status !== 'draft') await this.accounting.postInvoiceIssued(tx, { invoiceId: invoice.id, number: invoice.number, amount: invoice.amount, currency: invoice.currency, departmentId: invoice.departmentId, actorId: userId });
      return invoice;
    });
  }

  async getHtml(userId: string, id: string) {
    const { InvoicePdfService } = await import('./invoice-pdf.service.js');
    const pdfService = new InvoicePdfService(this.prisma, this);
    const html = await pdfService.generateHtml(userId, id);
    return { html };
  }
}
