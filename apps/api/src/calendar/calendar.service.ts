import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.calendarEvent.findMany({ where: scope.isAdmin ? {} : { OR: [{ ownerId: userId }, { departmentId: { in: scope.departmentIds } }] }, include: { owner: true, department: true }, orderBy: { startsAt: 'asc' } });
  }
  async create(userId: string, dto: any) {
    await getUserScope(this.prisma, userId);
    return this.prisma.calendarEvent.create({ data: { ...dto, ownerId: userId }, include: { owner: true, department: true } });
  }
}
