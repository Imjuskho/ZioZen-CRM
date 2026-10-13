import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return getUserScope(this.prisma, userId).then((scope) =>
      this.prisma.ticket.findMany({
        where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
        include: { department: true, assignee: true, customer: true, requester: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.ticket.create({
      data: {
        subject: dto.subject,
        message: dto.message,
        departmentId: dto.departmentId,
        priority: dto.priority,
        customerId: dto.customerId,
        requesterId: userId,
        assigneeId: dto.assigneeId,
      },
      include: { department: true, assignee: true, customer: true, requester: true },
    });
  }

  async update(userId: string, id: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, ticket.departmentId);
    return this.prisma.ticket.update({ where: { id }, data: dto });
  }
}
