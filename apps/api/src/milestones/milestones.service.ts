import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string, projectId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (!scope.isAdmin && !scope.departmentIds.includes(project.departmentId)) throw new ForbiddenException('No access');
    return this.prisma.taskMilestone.findMany({ where: { projectId }, orderBy: { dueDate: 'asc' } });
  }
  async create(userId: string, projectId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (!scope.isAdmin && !scope.departmentIds.includes(project.departmentId)) throw new ForbiddenException('No access');
    return this.prisma.taskMilestone.create({ data: { ...dto, projectId } });
  }
  async complete(userId: string, id: string, completed: boolean) {
    const scope = await getUserScope(this.prisma, userId);
    const milestone = await this.prisma.taskMilestone.findUnique({ where: { id }, include: { project: true } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (!scope.isAdmin && !scope.departmentIds.includes(milestone.project.departmentId)) throw new ForbiddenException('No access');
    return this.prisma.taskMilestone.update({ where: { id }, data: { completed } });
  }
}
