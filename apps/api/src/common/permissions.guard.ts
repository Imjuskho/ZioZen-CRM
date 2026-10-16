import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, hasPermission } from './department-scope.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { userId: string }; body?: { departmentId?: string }; query?: { departmentId?: string } }>();
    if (!request.user?.userId) throw new ForbiddenException('Authentication required');
    const scope = await getUserScope(this.prisma, request.user.userId);
    const departmentId = request.body?.departmentId ?? request.query?.departmentId;
    if (!required.some((permission) => hasPermission(scope, permission, departmentId))) throw new ForbiddenException(`Missing permission: ${required.join(' or ')}`);
    return true;
  }
}
