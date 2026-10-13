import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoiceItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, invoiceId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);
    return this.prisma.invoiceItem.findMany({ where: { invoiceId }, orderBy: { sortOrder: 'asc' } });
  }

  async add(userId: string, invoiceId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);
    const amount = new Prisma.Decimal(dto.quantity ?? 1).mul(new Prisma.Decimal(dto.rate ?? 0));
    const item = await this.prisma.invoiceItem.create({
      data: {
        invoiceId,
        description: dto.description,
        quantity: dto.quantity ?? 1,
        rate: dto.rate ?? 0,
        taxPercent: dto.taxPercent ?? 0,
        discount: dto.discount ?? 0,
        amount,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.recalc(invoiceId);
    return item;
  }

  private async recalc(invoiceId: string) {
    const items = await this.prisma.invoiceItem.findMany({ where: { invoiceId } });
    const total = items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { amount: total } });
  }
}
