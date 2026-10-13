import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string, customerId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ForbiddenException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);
    return this.prisma.contact.findMany({ where: { customerId }, orderBy: { isPrimary: 'desc' } });
  }
  async create(userId: string, customerId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ForbiddenException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);
    return this.prisma.contact.create({ data: { ...dto, customerId } });
  }
}
