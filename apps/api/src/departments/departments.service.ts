import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.department.findMany({ where: { id: { in: scope.departmentIds } }, orderBy: { name: 'asc' } });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, id);
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(userId: string, dto: CreateDepartmentDto) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin) throw new ForbiddenException('Only organization administrators can create departments');
    return this.prisma.department.create({ data: { ...dto, organizationId: scope.organizationId } });
  }

  async update(userId: string, id: string, dto: Partial<CreateDepartmentDto>) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, id);
    return this.prisma.department.delete({ where: { id } });
  }
}
