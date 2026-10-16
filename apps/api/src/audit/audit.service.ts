import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    action: string;
    entityType: string;
    entityId?: string;
    departmentId?: string;
    actorId?: string;
    organizationId?: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: unknown;
  }, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    const organizationId = data.organizationId ?? (data.actorId ? (await client.user.findUnique({ where: { id: data.actorId }, select: { organizationId: true } }))?.organizationId ?? undefined : undefined);
    return client.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        departmentId: data.departmentId,
        actorId: data.actorId,
        organizationId,
        requestId: data.requestId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata as any,
      },
    });
  }
}
