import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, invoiceId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async create(userId: string, invoiceId: string, dto: CreatePaymentDto) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);

    const paymentAmount = new Prisma.Decimal(dto.amount);
    if (paymentAmount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // Idempotency check: prevent duplicate payment if transactionId is specified
    if (dto.transactionId) {
      const existingTx = await this.prisma.payment.findFirst({
        where: { transactionId: dto.transactionId },
      });
      if (existingTx) {
        throw new ConflictException(`Payment with transactionId ${dto.transactionId} already processed`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Calculate current paid total
      const existingPayments = await tx.payment.findMany({ where: { invoiceId } });
      const currentPaid = existingPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0),
      );

      const newTotalPaid = currentPaid.add(paymentAmount);
      if (newTotalPaid.gt(invoice.amount)) {
        const remaining = invoice.amount.minus(currentPaid);
        throw new BadRequestException(
          `Payment amount exceeds outstanding invoice balance. Remaining balance is $${remaining.toFixed(2)}`,
        );
      }

      // 2. Create payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          currency: invoice.currency,
          method: dto.method,
          transactionId: dto.transactionId,
          notes: dto.notes,
        },
      });

      // 3. Update invoice status (paid or partially_paid)
      const newStatus = newTotalPaid.gte(invoice.amount) ? 'paid' : 'partially_paid';
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });

      // 4. Log audit record
      await this.audit.log({
        action: 'PAYMENT_RECORDED',
        entityType: 'Payment',
        entityId: payment.id,
        departmentId: invoice.departmentId,
        actorId: userId,
        metadata: {
          invoiceId,
          amount: paymentAmount.toString(),
          newStatus,
          transactionId: dto.transactionId,
        },
      });

      return {
        payment,
        invoiceStatus: newStatus,
        totalPaid: newTotalPaid.toString(),
        outstandingBalance: invoice.amount.minus(newTotalPaid).toString(),
      };
    });
  }
}
