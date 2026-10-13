import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}
  list() { return this.prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }); }
  create(dto: any) { return this.prisma.announcement.create({ data: dto }); }
  update(id: string, dto: any) { return this.prisma.announcement.update({ where: { id }, data: dto }); }
}
