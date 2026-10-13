import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.lead.findMany({ where: scope.isAdmin ? {} : { OR: [{ ownerId: userId }, { departmentId: { in: scope.departmentIds } }] }, include: { owner: true, department: true, customer: true }, orderBy: { createdAt: 'desc' } });
  }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    if (dto.departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.lead.create({ data: { ...dto, ownerId: userId }, include: { owner: true, department: true, customer: true } });
  }
  async update(userId: string, id: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ForbiddenException('Lead not found');
    if (lead.departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, lead.departmentId);
    return this.prisma.lead.update({ where: { id }, data: dto });
  }
}
