import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import {
  CreateTicketDto,
  UpdateTicketDto,
  CreateTicketReplyDto,
} from './dto/ticket.dto.js';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.ticket.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: {
        department: true,
        assignee: true,
        customer: true,
        requester: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        department: true,
        assignee: true,
        customer: true,
        requester: true,
        replies: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, ticket.departmentId);

    return ticket;
  }

  async create(userId: string, dto: CreateTicketDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    const ticket = await this.prisma.ticket.create({
      data: {
        subject: dto.subject,
        message: dto.message,
        departmentId: dto.departmentId,
        priority: dto.priority ?? 'normal',
        customerId: dto.customerId,
        requesterId: userId,
        assigneeId: dto.assigneeId,
        status: 'open',
      },
      include: {
        department: true,
        assignee: true,
        customer: true,
        requester: true,
      },
    });

    await this.audit.log({
      action: 'TICKET_CREATED',
      entityType: 'Ticket',
      entityId: ticket.id,
      departmentId: ticket.departmentId,
      actorId: userId,
      metadata: { subject: ticket.subject, priority: ticket.priority },
    });

    return ticket;
  }

  async update(userId: string, id: string, dto: UpdateTicketDto) {
    const scope = await getUserScope(this.prisma, userId);
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, ticket.departmentId);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: dto,
      include: {
        department: true,
        assignee: true,
        customer: true,
        requester: true,
      },
    });

    await this.audit.log({
      action: 'TICKET_UPDATED',
      entityType: 'Ticket',
      entityId: id,
      departmentId: ticket.departmentId,
      actorId: userId,
      metadata: { changes: dto },
    });

    return updated;
  }

  async addReply(userId: string, ticketId: string, dto: CreateTicketReplyDto) {
    const scope = await getUserScope(this.prisma, userId);
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, ticket.departmentId);

    const reply = await this.prisma.ticketReply.create({
      data: {
        ticketId,
        authorId: userId,
        body: dto.body,
        internal: dto.internal ?? false,
      },
      include: { author: true },
    });

    await this.audit.log({
      action: dto.internal ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_REPLY_ADDED',
      entityType: 'TicketReply',
      entityId: reply.id,
      departmentId: ticket.departmentId,
      actorId: userId,
      metadata: { ticketId, internal: reply.internal },
    });

    return reply;
  }
}
