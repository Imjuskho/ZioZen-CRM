import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(userId: string) {
    await getUserScope(this.prisma, userId);
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }
  async create(userId: string, dto: any) {
    await getUserScope(this.prisma, userId);
    return this.prisma.webhook.create({ data: { ...dto, ownerId: userId } });
  }
}
