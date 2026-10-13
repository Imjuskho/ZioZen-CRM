import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope } from '../common/department-scope.js';
import { AuditService } from '../audit/audit.service.js';

export type ExportScope = 'customers' | 'leads' | 'invoices';

@Injectable()
export class DataMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportData(userId: string, scopeName: ExportScope, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);

    if (departmentId && !scope.isAdmin && !scope.departmentIds.includes(departmentId)) {
      throw new BadRequestException('Access denied to specified department for export');
    }

    const deptFilter = departmentId
      ? { departmentId }
      : scope.isAdmin
      ? {}
      : { departmentId: { in: scope.departmentIds } };

    let data: any[] = [];

    if (scopeName === 'customers') {
      data = await this.prisma.customer.findMany({
        where: deptFilter,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          departmentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (scopeName === 'leads') {
      data = await this.prisma.lead.findMany({
        where: deptFilter,
        select: {
          id: true,
          title: true,
          source: true,
          status: true,
          value: true,
          email: true,
          phone: true,
          notes: true,
          departmentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (scopeName === 'invoices') {
      data = await this.prisma.invoice.findMany({
        where: deptFilter,
        select: {
          id: true,
          number: true,
          amount: true,
          currency: true,
          status: true,
          departmentId: true,
          customerId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      throw new BadRequestException(`Unsupported export entity: ${scopeName}`);
    }

    await this.audit.log({
      action: 'DATA_EXPORTED',
      entityType: scopeName,
      actorId: userId,
      metadata: { count: data.length, departmentId: departmentId ?? 'all' },
    });

    return {
      entity: scopeName,
      timestamp: new Date().toISOString(),
      count: data.length,
      records: data,
    };
  }

  async importData(
    userId: string,
    scopeName: ExportScope,
    departmentId: string,
    records: Array<Record<string, any>>,
  ) {
    const scope = await getUserScope(this.prisma, userId);

    if (!scope.isAdmin && !scope.departmentIds.includes(departmentId)) {
      throw new BadRequestException('Access denied to specified department for import');
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new BadRequestException('Import records must be a non-empty array');
    }

    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of records) {
        if (scopeName === 'customers') {
          if (!item.name) throw new BadRequestException('Customer import record requires a "name" property');
          const created = await tx.customer.create({
            data: {
              name: String(item.name),
              email: item.email ? String(item.email) : null,
              phone: item.phone ? String(item.phone) : null,
              company: item.company ? String(item.company) : null,
              departmentId,
            },
          });
          createdIds.push(created.id);
        } else if (scopeName === 'leads') {
          if (!item.title) throw new BadRequestException('Lead import record requires a "title" property');
          const created = await tx.lead.create({
            data: {
              title: String(item.title),
              source: item.source ? String(item.source) : 'Import',
              status: item.status ? String(item.status) : 'new',
              value: item.value !== undefined ? String(item.value) : null,
              email: item.email ? String(item.email) : null,
              phone: item.phone ? String(item.phone) : null,
              notes: item.notes ? String(item.notes) : null,
              departmentId,
            },
          });
          createdIds.push(created.id);
        } else {
          throw new BadRequestException(`Import not implemented for entity: ${scopeName}`);
        }
      }
    });

    await this.audit.log({
      action: 'DATA_IMPORTED',
      entityType: scopeName,
      actorId: userId,
      metadata: { importedCount: createdIds.length, departmentId },
    });

    return {
      success: true,
      entity: scopeName,
      importedCount: createdIds.length,
      ids: createdIds,
    };
  }
}
