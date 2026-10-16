import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope } from '../common/department-scope.js';
import { CreateWebhookDto } from '../common/dto/extensibility.dto.js';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.webhook.findMany({ where: scope.organizationId ? { owner: { organizationId: scope.organizationId } } : { ownerId: userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, dto: CreateWebhookDto) {
    const scope = await getUserScope(this.prisma, userId);
    const webhook = await this.prisma.webhook.create({
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        active: dto.active ?? true,
        ownerId: userId,
      },
    });

    await this.audit.log({
      action: 'WEBHOOK_CONFIGURED',
      entityType: 'Webhook',
      entityId: webhook.id,
      actorId: userId,
      organizationId: scope.organizationId ?? undefined,
      metadata: { name: webhook.name, url: webhook.url, events: webhook.events },
    });

    return webhook;
  }
}
