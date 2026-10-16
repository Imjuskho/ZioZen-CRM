import { ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInboxChannelDto, InboundMessageDto } from './wave5.dto.js';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async channels(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.inboxChannel.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, select: { id: true, channel: true, active: true, departmentId: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }

  async createChannel(userId: string, dto: CreateInboxChannelDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const channel = await this.prisma.inboxChannel.create({ data: { channel: dto.channel, secret: await bcrypt.hash(dto.secret, 12), departmentId: dto.departmentId, createdById: userId } });
    await this.audit.log({ action: 'INBOX_CHANNEL_CONFIGURED', entityType: 'InboxChannel', entityId: channel.id, departmentId: dto.departmentId, actorId: userId, metadata: { channel: dto.channel } });
    return { id: channel.id, channel: channel.channel, departmentId: channel.departmentId, active: channel.active };
  }

  async threads(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.inboxThread.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { customer: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  }

  async receive(channelName: string, secret: string | undefined, dto: InboundMessageDto) {
    const channels = await this.prisma.inboxChannel.findMany({ where: { channel: channelName, active: true } });
    const channel = (await Promise.all(channels.map(async (item) => secret && await bcrypt.compare(secret, item.secret) ? item : null))).find(Boolean);
    if (!channel) throw new ForbiddenException('Invalid or inactive inbox channel');
    const existing = await this.prisma.inboxMessage.findFirst({ where: { externalId: dto.eventId, thread: { departmentId: channel.departmentId } } });
    if (existing) return this.prisma.inboxThread.findUnique({ where: { id: existing.threadId }, include: { messages: true } });
    const customer = dto.email || dto.phone ? await this.prisma.customer.findFirst({ where: { departmentId: channel.departmentId, OR: [{ email: dto.email ?? undefined }, { phone: dto.phone ?? undefined }] } }) : null;
    const thread = await this.prisma.inboxThread.create({ data: { channel: channelName, externalId: dto.externalThreadId, subject: dto.subject?.trim() || 'Inbound conversation', externalEmail: dto.email, externalPhone: dto.phone, departmentId: channel.departmentId, customerId: customer?.id, messages: { create: { externalId: dto.eventId, direction: dto.direction ?? 'inbound', sender: dto.sender, body: dto.body, metadata: dto.metadata as Prisma.InputJsonValue | undefined } } }, include: { customer: true, messages: true } });
    await this.audit.log({ action: 'INBOX_MESSAGE_RECEIVED', entityType: 'InboxMessage', entityId: thread.messages[0].id, departmentId: channel.departmentId, metadata: { channel: channelName, matchedCustomerId: customer?.id ?? null, eventId: dto.eventId } });
    return thread;
  }
}
