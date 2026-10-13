import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(userId: string, departmentId?: string) {
    return getUserScope(this.prisma, userId).then((scope) =>
      this.prisma.expense.findMany({
        where: {
          ...(scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }),
          ...(departmentId ? { departmentId } : {}),
        },
        include: { department: true, owner: true },
        orderBy: { expenseDate: 'desc' },
      }),
    );
  }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.expense.create({ data: { ...dto, ownerId: userId }, include: { department: true, owner: true } });
  }
}
