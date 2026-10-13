import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto.js';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.contract.findMany({
      where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } },
      include: { department: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { department: true, customer: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, contract.departmentId);
    return contract;
  }

  async create(userId: string, dto: CreateContractDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);

    const contract = await this.prisma.contract.create({
      data: {
        subject: dto.subject,
        value: dto.value ? new Prisma.Decimal(dto.value) : undefined,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        content: dto.content,
        ownerId: userId,
        status: 'draft',
      },
      include: { department: true, customer: true },
    });

    await this.audit.log({
      action: 'CONTRACT_CREATED',
      entityType: 'Contract',
      entityId: contract.id,
      departmentId: contract.departmentId,
      actorId: userId,
      metadata: { subject: contract.subject, value: dto.value },
    });

    return contract;
  }

  async update(userId: string, id: string, dto: UpdateContractDto) {
    const scope = await getUserScope(this.prisma, userId);
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, contract.departmentId);

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        value: dto.value !== undefined ? (dto.value ? new Prisma.Decimal(dto.value) : null) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: { department: true, customer: true },
    });

    await this.audit.log({
      action: 'CONTRACT_UPDATED',
      entityType: 'Contract',
      entityId: id,
      departmentId: contract.departmentId,
      actorId: userId,
      metadata: { changes: dto },
    });

    return updated;
  }
}
