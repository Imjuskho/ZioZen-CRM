import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(userId: string) { return getUserScope(this.prisma, userId).then((scope) => this.prisma.proposal.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: true, customer: true }, orderBy: { createdAt: 'desc' } })); }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.proposal.create({ data: dto, include: { department: true, customer: true } });
  }
  async accept(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const item = await this.prisma.proposal.findUnique({ where: { id } });
    if (!item) throw new ForbiddenException('Proposal not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, item.departmentId);
    return this.prisma.proposal.update({ where: { id }, data: { status: 'accepted', acceptedAt: new Date() } });
  }
}
