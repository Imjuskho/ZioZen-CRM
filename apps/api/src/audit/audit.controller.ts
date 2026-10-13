import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    const scope = await getUserScope(this.prisma, req.user.userId);
    return this.prisma.auditLog.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
