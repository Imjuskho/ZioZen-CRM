import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class RecurringInvoicesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.recurringInvoice.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: true, customer: true }, orderBy: { nextRunAt: 'asc' } });
  }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.recurringInvoice.create({ data: dto, include: { department: true, customer: true } });
  }
  async update(userId: string, id: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const item = await this.prisma.recurringInvoice.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Recurring invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, item.departmentId);
    return this.prisma.recurringInvoice.update({ where: { id }, data: dto });
  }
}
