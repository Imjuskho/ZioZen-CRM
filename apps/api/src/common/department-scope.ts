import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ScopedUser {
  userId: string;
}

export async function getUserScope(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true, accessGrants: true },
  });

  if (!user || !user.active) {
    throw new ForbiddenException('Inactive or unknown user');
  }

  const isAdmin = user.role === 'ADMIN';
  const departmentWhere = user.organizationId ? { organizationId: user.organizationId } : { organizationId: null };
  const departmentIds = isAdmin
    ? (await prisma.department.findMany({ where: departmentWhere, select: { id: true } })).map((d) => d.id)
    : user.memberships.map((m) => m.departmentId);

  return {
    user,
    isAdmin,
    organizationId: user.organizationId,
    departmentIds,
    permissions: user.accessGrants.map((grant) => ({ permission: grant.permission, departmentId: grant.departmentId })),
  };
}

export function ensureDepartmentAccess(isAdmin: boolean, departmentIds: string[], departmentId: string) {
  if (!departmentIds.includes(departmentId)) {
    throw new ForbiddenException('No access to this department');
  }
}

export function hasPermission(scope: Awaited<ReturnType<typeof getUserScope>>, permission: string, departmentId?: string) {
  if (scope.isAdmin) return true;
  const roleDefaults: Record<string, string[]> = {
    MANAGER: ['finance.read', 'finance.write', 'finance.import', 'people.read', 'people.manage', 'people.payroll', 'automation.read', 'automation.manage', 'inbox.manage', 'export.read'],
    MEMBER: ['finance.read', 'finance.write', 'finance.import', 'people.read', 'people.manage', 'people.payroll', 'automation.read', 'automation.manage', 'inbox.manage', 'export.read'],
    VIEWER: ['finance.read', 'people.read', 'automation.read', 'export.read'],
  };
  if (roleDefaults[scope.user.role]?.includes(permission)) return true;
  return scope.permissions.some((grant) => grant.permission === permission && (!grant.departmentId || grant.departmentId === departmentId));
}

export function ensurePermission(scope: Awaited<ReturnType<typeof getUserScope>>, permission: string, departmentId?: string) {
  if (!hasPermission(scope, permission, departmentId)) {
    throw new ForbiddenException(`Missing permission: ${permission}`);
  }
}
