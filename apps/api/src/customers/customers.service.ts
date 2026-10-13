import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.customer.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, owner: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateCustomerDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const customer = await this.prisma.customer.create({
      data: { ...dto, ownerId: userId },
      include: { department: true, owner: true },
    });
    await this.audit.log({
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      departmentId: customer.departmentId,
      actorId: userId,
      metadata: { name: customer.name, email: customer.email },
    });
    return customer;
  }
}
