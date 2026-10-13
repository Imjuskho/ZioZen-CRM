import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { CreateLeadDto, UpdateLeadDto, ConvertLeadDto } from './dto/lead.dto.js';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.lead.findMany({
      where: scope.isAdmin
        ? {}
        : {
            OR: [
              { ownerId: userId },
              { departmentId: { in: scope.departmentIds } },
            ],
          },
      include: { owner: true, department: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { owner: true, department: true, customer: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.departmentId) {
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, lead.departmentId);
    }
    return lead;
  }

  async create(userId: string, dto: CreateLeadDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    const lead = await this.prisma.lead.create({
      data: {
        title: dto.title,
        source: dto.source,
        status: dto.status ?? 'new',
        value: dto.value ? Number(dto.value) : undefined,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        ownerId: userId,
      },
      include: { owner: true, department: true, customer: true },
    });

    await this.audit.log({
      action: 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: lead.id,
      departmentId: lead.departmentId ?? undefined,
      actorId: userId,
      metadata: { title: lead.title, value: dto.value },
    });

    return lead;
  }

  async update(userId: string, id: string, dto: UpdateLeadDto) {
    const scope = await getUserScope(this.prisma, userId);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.departmentId) {
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, lead.departmentId);
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        value: dto.value !== undefined ? (dto.value ? Number(dto.value) : null) : undefined,
      },
      include: { owner: true, department: true, customer: true },
    });

    await this.audit.log({
      action: 'LEAD_UPDATED',
      entityType: 'Lead',
      entityId: id,
      departmentId: lead.departmentId ?? undefined,
      actorId: userId,
      metadata: { changes: dto },
    });

    return updated;
  }

  async convert(userId: string, id: string, dto: ConvertLeadDto) {
    const scope = await getUserScope(this.prisma, userId);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (!lead.departmentId) {
      throw new BadRequestException('Lead must belong to a department before conversion');
    }
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, lead.departmentId);

    if (lead.customerId) {
      throw new BadRequestException('Lead has already been converted to a customer');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or link customer
      const customer = await tx.customer.create({
        data: {
          name: dto.companyName || lead.title,
          email: lead.email,
          phone: lead.phone,
          company: dto.companyName || lead.title,
          notes: lead.notes,
          departmentId: lead.departmentId!,
          ownerId: userId,
        },
      });

      // 2. Optionally create project
      let project = null;
      if (dto.projectName) {
        project = await tx.project.create({
          data: {
            name: dto.projectName,
            departmentId: lead.departmentId!,
            customerId: customer.id,
            ownerId: userId,
          },
        });
      }

      // 3. Mark lead as converted and link customer
      const convertedLead = await tx.lead.update({
        where: { id },
        data: {
          status: 'converted',
          customerId: customer.id,
        },
      });

      // 4. Log audit events
      await this.audit.log({
        action: 'LEAD_CONVERTED',
        entityType: 'Lead',
        entityId: id,
        departmentId: lead.departmentId!,
        actorId: userId,
        metadata: { customerId: customer.id, projectId: project?.id },
      });

      return {
        lead: convertedLead,
        customer,
        project,
      };
    });
  }
}
