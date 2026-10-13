import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.project.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, owner: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateProjectDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        ownerId: dto.ownerId ?? userId,
      },
      include: { department: true, owner: true, customer: true },
    });
  }

  async remove(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new ForbiddenException('Project not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, project.departmentId);
    return this.prisma.project.delete({ where: { id } });
  }
}
