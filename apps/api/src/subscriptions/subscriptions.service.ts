import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.subscription.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, customer: true },
      orderBy: { nextBillingDate: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: { department: true, customer: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, sub.departmentId);
    return sub;
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    const sub = await this.prisma.subscription.create({
      data: {
        name: dto.name,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'USD',
        interval: dto.interval ?? 'monthly',
        nextBillingDate: new Date(dto.nextBillingDate),
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        ownerId: userId,
        status: 'active',
        notes: dto.notes,
      },
      include: { department: true, customer: true },
    });

    await this.audit.log({
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'Subscription',
      entityId: sub.id,
      departmentId: sub.departmentId,
      actorId: userId,
      metadata: { name: sub.name, amount: dto.amount, interval: sub.interval },
    });

    return sub;
  }

  async update(userId: string, id: string, dto: UpdateSubscriptionDto) {
    const scope = await getUserScope(this.prisma, userId);
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, sub.departmentId);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        nextBillingDate: dto.nextBillingDate ? new Date(dto.nextBillingDate) : undefined,
      },
      include: { department: true, customer: true },
    });

    await this.audit.log({
      action: 'SUBSCRIPTION_UPDATED',
      entityType: 'Subscription',
      entityId: id,
      departmentId: sub.departmentId,
      actorId: userId,
      metadata: { changes: dto },
    });

    return updated;
  }
}
