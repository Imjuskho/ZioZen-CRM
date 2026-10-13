import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ScopedUser {
  userId: string;
}

export async function getUserScope(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true },
  });

  if (!user || !user.active) {
    throw new ForbiddenException('Inactive or unknown user');
  }

  const isAdmin = user.role === 'ADMIN';
  const departmentIds = isAdmin
    ? (await prisma.department.findMany({ select: { id: true } })).map((d) => d.id)
    : user.memberships.map((m) => m.departmentId);

  return { user, isAdmin, departmentIds };
}

export function ensureDepartmentAccess(
  isAdmin: boolean,
  departmentIds: string[],
  departmentId: string,
) {
  if (!isAdmin && !departmentIds.includes(departmentId)) {
    throw new ForbiddenException('No access to this department');
  }
}
