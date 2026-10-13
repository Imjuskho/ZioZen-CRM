import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Request() req: { user: { userId: string } },
    @Query('departmentId') departmentId?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await getUserScope(this.prisma, req.user.userId);
    const params: { departmentId?: string; entityType?: string; departmentIds: string[]; isAdmin: boolean; limit: number } = {
      departmentIds: scope.departmentIds,
      isAdmin: scope.isAdmin,
      limit: Math.min(Number(limit) || 100, 500),
    };
    if (departmentId) params.departmentId = departmentId;
    if (entityType) params.entityType = entityType;

    return this.prisma.auditLog.findMany({
      where: {
        ...(params.isAdmin ? {} : { departmentId: { in: params.departmentIds } }),
        ...(params.departmentId ? { departmentId: params.departmentId } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
      },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: params.limit,
    });
  }
}
