import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';

type RedisConnection = { host: string; port: number; password?: string; maxRetriesPerRequest: null; enableReadyCheck: false };

@Injectable()
export class OperationsService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(private readonly prisma: PrismaService) {
    const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const connection: RedisConnection = { host: redisUrl.hostname, port: Number(redisUrl.port || 6379), password: redisUrl.password || undefined, maxRetriesPerRequest: null, enableReadyCheck: false };
    this.queue = new Queue('tenant-exports', { connection });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async health() {
    const startedAt = performance.now();
    let database: { status: string; latencyMs?: number; error?: string };
    try {
      const dbStart = performance.now();
      await this.prisma.$queryRaw`SELECT 1`;
      database = { status: 'ok', latencyMs: Math.round(performance.now() - dbStart) };
    } catch (error) {
      database = { status: 'error', error: error instanceof Error ? error.message : 'Database probe failed' };
    }

    let redis: { status: string; latencyMs?: number; error?: string };
    let queue: Record<string, number> = {};
    try {
      const redisStart = performance.now();
      queue = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
      redis = { status: 'ok', latencyMs: Math.round(performance.now() - redisStart) };
    } catch (error) {
      redis = { status: 'error', error: error instanceof Error ? error.message : 'Redis probe failed' };
    }

    const status = database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';
    return { status, generatedAt: new Date().toISOString(), responseTimeMs: Math.round(performance.now() - startedAt), services: { api: { status: 'ok' }, database, redis, bullmq: { status: redis.status, queue: 'tenant-exports', counts: queue } } };
  }

  async tenantSupportTimeline(userId: string, limit = 40) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.organizationId) return { organizationId: null, entries: [] };
    const take = Math.max(1, Math.min(limit, 100));
    const [audit, exports, sessions] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { organizationId: scope.organizationId }, orderBy: { createdAt: 'desc' }, take, select: { id: true, action: true, entityType: true, entityId: true, actorId: true, requestId: true, createdAt: true } }),
      this.prisma.exportJob.findMany({ where: { organizationId: scope.organizationId }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 25), select: { id: true, status: true, progress: true, recordCount: true, error: true, createdAt: true, completedAt: true } }),
      this.prisma.session.findMany({ where: { organizationId: scope.organizationId }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 25), select: { id: true, userId: true, ipAddress: true, userAgent: true, lastSeenAt: true, revokedAt: true, createdAt: true } }),
    ]);
    const entries = [
      ...audit.map((item) => ({ type: 'audit', at: item.createdAt, action: item.action, entityType: item.entityType, entityId: item.entityId, actorId: item.actorId, requestId: item.requestId })),
      ...exports.map((item) => ({ type: 'export', at: item.completedAt ?? item.createdAt, action: `EXPORT_${item.status.toUpperCase()}`, entityType: 'ExportJob', entityId: item.id, status: item.status, progress: item.progress, recordCount: item.recordCount, error: item.error })),
      ...sessions.map((item) => ({ type: 'session', at: item.revokedAt ?? item.lastSeenAt, action: item.revokedAt ? 'SESSION_REVOKED' : 'SESSION_ACTIVE', entityType: 'Session', entityId: item.id, actorId: item.userId, ipAddress: item.ipAddress, userAgent: item.userAgent })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, take);
    return { organizationId: scope.organizationId, generatedAt: new Date().toISOString(), entries };
  }

  async diagnosticBundle(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.organizationId) return { schemaVersion: '2026-10-14', organizationId: null, generatedAt: new Date().toISOString(), redactions: ['organization data unavailable without tenant membership'] };
    const [health, timeline, counts] = await Promise.all([
      this.health(),
      this.tenantSupportTimeline(userId, 30),
      Promise.all([
        this.prisma.user.count({ where: { organizationId: scope.organizationId } }),
        this.prisma.department.count({ where: { organizationId: scope.organizationId } }),
        this.prisma.auditLog.count({ where: { organizationId: scope.organizationId } }),
        this.prisma.exportJob.count({ where: { organizationId: scope.organizationId, status: 'failed' } }),
      ]),
    ]);
    return { schemaVersion: '2026-10-14', generatedAt: new Date().toISOString(), organizationId: scope.organizationId, health: { status: health.status, services: health.services, responseTimeMs: health.responseTimeMs }, counts: { users: counts[0], departments: counts[1], auditEvents: counts[2], failedExports: counts[3] }, timeline, redactions: ['passwords', 'tokens', 'webhook secrets', 'export payloads', 'request bodies', 'full IP addresses'] };
  }
}
