import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateCustomFieldDto, SetCustomFieldValueDto } from '../common/dto/extensibility.dto.js';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(entityType?: string) {
    return this.prisma.customField.findMany({
      where: entityType ? { entityType } : {},
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateCustomFieldDto) {
    const field = await this.prisma.customField.create({ data: dto });
    await this.audit.log({
      action: 'CUSTOM_FIELD_CREATED',
      entityType: 'CustomField',
      entityId: field.id,
      actorId: userId,
      metadata: { name: field.name, entityType: field.entityType },
    });
    return field;
  }

  async setValue(userId: string, dto: SetCustomFieldValueDto) {
    const val = await this.prisma.customFieldValue.upsert({
      where: { customFieldId_entityId: { customFieldId: dto.customFieldId, entityId: dto.entityId } },
      update: { value: dto.value, entityType: dto.entityType },
      create: {
        customFieldId: dto.customFieldId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        value: dto.value,
      },
      include: { customField: true },
    });

    await this.audit.log({
      action: 'CUSTOM_FIELD_VALUE_UPDATED',
      entityType: 'CustomFieldValue',
      entityId: val.id,
      actorId: userId,
      metadata: { entityType: dto.entityType, entityId: dto.entityId, fieldName: val.customField.name },
    });

    return val;
  }

  values(entityType: string, entityId: string) {
    return this.prisma.customFieldValue.findMany({
      where: { entityType, entityId },
      include: { customField: true },
    });
  }
}
