import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async departmentSummary(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const departments = await this.prisma.department.findMany({
      where: scope.isAdmin ? {} : { id: { in: scope.departmentIds } },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      departments.map(async (department) => {
        const [projects, tasks, customers, invoices] = await Promise.all([
          this.prisma.project.count({ where: { departmentId: department.id } }),
          this.prisma.task.count({ where: { departmentId: department.id } }),
          this.prisma.customer.count({ where: { departmentId: department.id } }),
          this.prisma.invoice.aggregate({
            where: { departmentId: department.id },
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
