import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
@Injectable()
export class CreditNotesService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(userId: string) { return getUserScope(this.prisma, userId).then((scope) => this.prisma.creditNote.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: true, customer: true }, orderBy: { createdAt: 'desc' } })); }
  async create(userId: string, dto: any) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    return this.prisma.creditNote.create({ data: dto, include: { department: true, customer: true } });
  }
}
