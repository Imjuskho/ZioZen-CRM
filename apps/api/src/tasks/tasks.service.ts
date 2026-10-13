import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.task.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, project: true, assignee: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateTaskDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        departmentId: dto.departmentId,
        projectId: dto.projectId,
        assigneeId: dto.assigneeId,
        customerId: dto.customerId,
      },
      include: { department: true, project: true, assignee: true, customer: true },
    });
  }

  async updateStatus(userId: string, id: string, status: string) {
    const scope = await getUserScope(this.prisma, userId);
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new ForbiddenException('Task not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, task.departmentId);
    return this.prisma.task.update({ where: { id }, data: { status } });
  }
}
