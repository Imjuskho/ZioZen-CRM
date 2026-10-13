import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(data: {
    action: string;
    entityType: string;
    entityId?: string;
    departmentId?: string;
    actorId?: string;
    metadata?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        departmentId: data.departmentId,
        actorId: data.actorId,
        metadata: data.metadata as any,
      },
    });
  }
}
