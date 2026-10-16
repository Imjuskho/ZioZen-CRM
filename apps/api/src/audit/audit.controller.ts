import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('compliance-report')
  async complianceReport(@Request() req: { user: { userId: string } }, @Query('from') from?: string, @Query('to') to?: string) {
    const scope = await getUserScope(this.prisma, req.user.userId);
    const date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const where = { organizationId: scope.organizationId ?? undefined, createdAt: date };
    const [events, byAction, byEntity, activeSessions, revokedSessions] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 20 }),
      this.prisma.auditLog.groupBy({ by: ['entityType'], where, _count: { _all: true }, orderBy: { _count: { entityType: 'desc' } }, take: 20 }),
      this.prisma.session.count({ where: { organizationId: scope.organizationId ?? undefined, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.session.count({ where: { organizationId: scope.organizationId ?? undefined, revokedAt: { not: null } } }),
    ]);
    return { organizationId: scope.organizationId, range: { from: from ?? null, to: to ?? null }, events, byAction, byEntity, sessions: { active: activeSessions, revoked: revokedSessions } };
  }

  @Get('alerts')
  async alerts(@Request() req: { user: { userId: string } }, @Query('hours') hours = '24', @Query('revokedThreshold') revokedThreshold = '3', @Query('suspiciousThreshold') suspiciousThreshold = '5') {
    const scope = await getUserScope(this.prisma, req.user.userId);
    const windowHours = Math.min(Math.max(Number(hours) || 24, 1), 168);
    const revokedLimit = Math.max(Number(revokedThreshold) || 3, 1);
    const suspiciousLimit = Math.max(Number(suspiciousThreshold) || 5, 1);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const organizationWhere = { organizationId: scope.organizationId ?? undefined, createdAt: { gte: since } };
    const [revokedSessions, events] = await Promise.all([
      this.prisma.session.count({ where: { organizationId: scope.organizationId ?? undefined, revokedAt: { gte: since } } }),
      this.prisma.auditLog.findMany({ where: organizationWhere, select: { id: true, action: true, entityType: true, actorId: true, ipAddress: true, requestId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);
    const suspicious = events.filter((event) => /failed|denied|forbidden|revok|suspicious|export|grant|delete|password|login/i.test(event.action));
    const byIp = new Map<string, number>();
    for (const event of suspicious) if (event.ipAddress) byIp.set(event.ipAddress, (byIp.get(event.ipAddress) ?? 0) + 1);
    const alerts: Array<{ code: string; severity: 'high' | 'medium'; title: string; detail: string; count: number; threshold: number; windowHours: number; ipAddress?: string }> = [];
    if (revokedSessions >= revokedLimit) alerts.push({ code: 'REVOCATION_SPIKE', severity: 'high', title: 'Session revocation spike', detail: `${revokedSessions} sessions were revoked in the last ${windowHours} hours.`, count: revokedSessions, threshold: revokedLimit, windowHours });
    if (suspicious.length >= suspiciousLimit) alerts.push({ code: 'SUSPICIOUS_AUDIT_ACTIVITY', severity: 'high', title: 'Suspicious audit activity', detail: `${suspicious.length} security-sensitive audit events matched the alert policy.`, count: suspicious.length, threshold: suspiciousLimit, windowHours });
    for (const [ipAddress, count] of byIp) if (count >= suspiciousLimit) alerts.push({ code: 'IP_ACTIVITY_SPIKE', severity: 'medium', title: 'Security-sensitive IP activity spike', detail: `${count} sensitive events were recorded from ${ipAddress}.`, count, threshold: suspiciousLimit, windowHours, ipAddress });
    return { generatedAt: new Date().toISOString(), windowHours, thresholds: { revokedSessions: revokedLimit, suspiciousEvents: suspiciousLimit }, alerts, summary: { revokedSessions, suspiciousEvents: suspicious.length, sensitiveIps: byIp.size } };
  }

  @Get()
  async findAll(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string, @Query('entityType') entityType?: string, @Query('action') action?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    const scope = await getUserScope(this.prisma, req.user.userId);
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: scope.organizationId ?? undefined,
        ...(!scope.isAdmin ? { departmentId: { in: scope.departmentIds } } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
        ...((from || to) ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
    });
  }
}
