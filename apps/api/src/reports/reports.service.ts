import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async departmentSummary(userId: string, filters?: { departmentId?: string; from?: string; to?: string }) {
    const scope = await getUserScope(this.prisma, userId);
    
    const targetDeptFilter: any = scope.isAdmin ? {} : { id: { in: scope.departmentIds } };
    if (filters?.departmentId) {
      targetDeptFilter.id = filters.departmentId;
    }

    const departments = await this.prisma.department.findMany({
      where: targetDeptFilter,
      orderBy: { name: 'asc' },
    });

    const dateFilter: any = {};
    if (filters?.from) {
      dateFilter.gte = new Date(filters.from);
    }
    if (filters?.to) {
      dateFilter.lte = new Date(filters.to);
    }
    const hasDate = Boolean(filters?.from || filters?.to);

    return Promise.all(
      departments.map(async (department) => {
        const itemDateWhere = hasDate ? { createdAt: dateFilter } : {};

        const [projects, tasks, customers, invoices] = await Promise.all([
          this.prisma.project.count({ where: { departmentId: department.id, ...itemDateWhere } }),
          this.prisma.task.count({ where: { departmentId: department.id, ...itemDateWhere } }),
          this.prisma.customer.count({ where: { departmentId: department.id, ...itemDateWhere } }),
          this.prisma.invoice.aggregate({
            where: { departmentId: department.id, ...itemDateWhere },
            _sum: { amount: true },
            _count: { _all: true },
          }),
        ]);

        return {
          department: { id: department.id, name: department.name, slug: department.slug },
          projects,
          tasks,
          customers,
          invoices: invoices._count._all,
          invoiceAmount: invoices._sum.amount?.toString() ?? '0',
        };
      }),
    );
  }
}
