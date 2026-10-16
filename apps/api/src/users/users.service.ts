import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(requesterId: string) {
    const scope = await getUserScope(this.prisma, requesterId);
    if (!scope.isAdmin) throw new ForbiddenException('Admin access required');
    return this.prisma.user.findMany({ where: scope.organizationId ? { organizationId: scope.organizationId } : { organizationId: null }, include: { memberships: { include: { department: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async update(requesterId: string, userId: string, dto: UpdateUserDto) {
    const scope = await getUserScope(this.prisma, requesterId);
    if (!scope.isAdmin) throw new ForbiddenException('Admin access required');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== scope.organizationId) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id: userId }, data: dto as any, include: { memberships: { include: { department: true } } } });
    await this.audit.log({ action: 'user.updated', entityType: 'User', entityId: userId, actorId: requesterId, metadata: dto });
    return updated;
  }

  async addMembership(requesterId: string, userId: string, departmentId: string, isPrimary = false) {
    const scope = await getUserScope(this.prisma, requesterId);
    if (!scope.isAdmin) throw new ForbiddenException('Admin access required');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== scope.organizationId) throw new NotFoundException('User not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    const membership = await this.prisma.userDepartment.upsert({ where: { userId_departmentId: { userId, departmentId } }, update: { isPrimary }, create: { userId, departmentId, isPrimary }, include: { department: true } });
    await this.audit.log({ action: 'user.membership.added', entityType: 'UserDepartment', entityId: `${userId}:${departmentId}`, departmentId, actorId: requesterId });
    return membership;
  }

  async removeMembership(requesterId: string, userId: string, departmentId: string) {
    const scope = await getUserScope(this.prisma, requesterId);
    if (!scope.isAdmin) throw new ForbiddenException('Admin access required');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== scope.organizationId) throw new NotFoundException('User not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    await this.prisma.userDepartment.deleteMany({ where: { userId, departmentId } });
    await this.audit.log({ action: 'user.membership.removed', entityType: 'UserDepartment', entityId: `${userId}:${departmentId}`, departmentId, actorId: requesterId });
    return { success: true };
  }
}
