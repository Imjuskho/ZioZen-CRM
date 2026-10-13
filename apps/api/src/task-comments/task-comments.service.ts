import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class TaskCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, taskId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, task.departmentId);
    return this.prisma.taskComment.findMany({ where: { taskId }, include: { author: true }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, taskId: string, body: string) {
    const scope = await getUserScope(this.prisma, userId);
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, task.departmentId);
    return this.prisma.taskComment.create({ data: { taskId, authorId: userId, body }, include: { author: true } });
  }
}
