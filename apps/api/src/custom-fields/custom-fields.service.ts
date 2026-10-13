import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(entityType?: string) {
    return this.prisma.customField.findMany({
      where: entityType ? { entityType } : {},
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  create(dto: any) {
    return this.prisma.customField.create({ data: dto });
  }

  update(id: string, dto: any) {
    return this.prisma.customField.update({ where: { id }, data: dto });
  }

  async setValue(customFieldId: string, entityType: string, entityId: string, value: string) {
    return this.prisma.customFieldValue.upsert({
      where: { customFieldId_entityId: { customFieldId, entityId } },
      update: { value, entityType },
      create: { customFieldId, entityType, entityId, value },
    });
  }

  values(entityType: string, entityId: string) {
    return this.prisma.customFieldValue.findMany({
      where: { entityType, entityId },
      include: { customField: true },
    });
  }
}
