import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { CreateEstimateDto } from './dto/estimate.dto.js';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.estimate.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      include: { department: true, customer: true, items: true },
    });
    if (!estimate) throw new NotFoundException('Estimate not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, estimate.departmentId);
    return estimate;
  }

  async create(userId: string, dto: CreateEstimateDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    // Calculate total from items
    let total = new Prisma.Decimal(0);
    const itemRecords: Array<{
      description: string;
      quantity: Prisma.Decimal;
      rate: Prisma.Decimal;
      taxPercent: Prisma.Decimal;
      discount: Prisma.Decimal;
      amount: Prisma.Decimal;
      sortOrder: number;
    }> = [];

    if (dto.items && dto.items.length > 0) {
      dto.items.forEach((item, index) => {
        const qty = new Prisma.Decimal(item.quantity ?? 1);
        const rate = new Prisma.Decimal(item.rate ?? 0);
        const tax = new Prisma.Decimal(item.taxPercent ?? 0);
        const discount = new Prisma.Decimal(item.discount ?? 0);

        const subtotal = qty.mul(rate).minus(discount);
        const taxAmount = subtotal.mul(tax).div(100);
        const amount = subtotal.add(taxAmount);

        total = total.add(amount);
        itemRecords.push({
          description: item.description,
          quantity: qty,
          rate,
          taxPercent: tax,
          discount,
          amount,
          sortOrder: index,
        });
      });
    }

    const estimate = await this.prisma.estimate.create({
      data: {
        number: dto.number,
        total,
        currency: dto.currency ?? 'USD',
        notes: dto.notes,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        ownerId: userId,
        status: 'draft',
        items: itemRecords.length > 0 ? { create: itemRecords } : undefined,
      },
      include: { department: true, customer: true, items: true },
    });

    await this.audit.log({
      action: 'ESTIMATE_CREATED',
      entityType: 'Estimate',
      entityId: estimate.id,
      departmentId: estimate.departmentId,
      actorId: userId,
      metadata: { number: estimate.number, total: total.toString() },
    });

    return estimate;
  }

  async convert(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!estimate) throw new NotFoundException('Estimate not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, estimate.departmentId);

    if (estimate.status === 'converted' && estimate.convertedInvoiceId) {
      throw new BadRequestException('Estimate has already been converted to an invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create invoice with exact snapshot total
      const invoice = await tx.invoice.create({
        data: {
          number: `INV-${estimate.number}`,
          amount: estimate.total,
          currency: estimate.currency,
          departmentId: estimate.departmentId,
          customerId: estimate.customerId,
          ownerId: userId,
          status: 'draft',
          notes: estimate.notes ? `Converted from estimate ${estimate.number}: ${estimate.notes}` : `Converted from estimate ${estimate.number}`,
          items:
            estimate.items.length > 0
              ? {
                  create: estimate.items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    taxPercent: item.taxPercent,
                    discount: item.discount,
                    amount: item.amount,
                    sortOrder: item.sortOrder,
                  })),
                }
              : undefined,
        },
        include: { department: true, customer: true, items: true },
      });

      // 2. Mark estimate as converted
      const updatedEstimate = await tx.estimate.update({
        where: { id },
        data: {
          status: 'converted',
          convertedInvoiceId: invoice.id,
        },
      });

      // 3. Log audit
      await this.audit.log({
        action: 'ESTIMATE_CONVERTED',
        entityType: 'Estimate',
        entityId: id,
        departmentId: estimate.departmentId,
        actorId: userId,
        metadata: { invoiceId: invoice.id, number: invoice.number },
      });

      return {
        estimate: updatedEstimate,
        invoice,
      };
    });
  }
}
