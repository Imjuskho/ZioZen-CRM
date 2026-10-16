import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AcceptInvitationDto, CreateAccessGrantDto, CreateInvitationDto, UpdateOrganizationProfileDto } from './access.dto.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async organizationProfile(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.organizationId) throw new NotFoundException('Organization profile not configured');
    return this.prisma.organization.findUnique({ where: { id: scope.organizationId } });
  }

  async updateOrganizationProfile(userId: string, dto: UpdateOrganizationProfileDto) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin || !scope.organizationId) throw new ForbiddenException('Only organization administrators can edit the profile');
    return this.prisma.organization.update({ where: { id: scope.organizationId }, data: { ...dto, businessHours: dto.businessHours as any } });
  }

  async invitations(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin || !scope.organizationId) throw new ForbiddenException('Only organization administrators can manage invitations');
    return this.prisma.invitation.findMany({ where: { organizationId: scope.organizationId }, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }

  async createInvitation(userId: string, dto: CreateInvitationDto) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.isAdmin || !scope.organizationId) throw new ForbiddenException('Only organization administrators can invite users');
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && existing.organizationId !== scope.organizationId) throw new ConflictException('Email belongs to another organization');
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + (dto.expiresInDays ?? 7) * 86400000);
    const invitation = await this.prisma.invitation.create({ data: { token, email: dto.email.toLowerCase(), role: dto.role ?? 'MEMBER', expiresAt, organizationId: scope.organizationId, invitedById: userId } });
    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, token: invitation.token };
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new ConflictException('Invitation is invalid or expired');
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new ConflictException('An account already exists for this email');
    const user = await this.prisma.user.create({ data: { email: invitation.email, passwordHash: await bcrypt.hash(dto.password, 12), firstName: dto.firstName, lastName: dto.lastName, role: invitation.role, organizationId: invitation.organizationId } });
    await this.prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return { userId: user.id, organizationId: user.organizationId, email: user.email };
  }

  async effectiveAccess(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return {
      organizationId: scope.organizationId,
      departmentIds: scope.departmentIds,
      role: scope.user.role,
      isOrganizationAdmin: scope.isAdmin,
      permissions: scope.permissions,
    };
  }

  async listGrants(actorId: string) {
    const scope = await getUserScope(this.prisma, actorId);
    if (!scope.isAdmin) throw new ForbiddenException('Only organization administrators can manage grants');
    return this.prisma.accessGrant.findMany({ where: scope.organizationId ? { organizationId: scope.organizationId } : { organizationId: null }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, department: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createGrant(actorId: string, dto: CreateAccessGrantDto) {
    const scope = await getUserScope(this.prisma, actorId);
    if (!scope.isAdmin) throw new ForbiddenException('Only organization administrators can manage grants');
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target || target.organizationId !== scope.organizationId) throw new NotFoundException('Target user is outside this organization');
    if (dto.departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const grant = await this.prisma.accessGrant.create({ data: { userId: dto.userId, permission: dto.permission.trim(), departmentId: dto.departmentId, organizationId: scope.organizationId } });
    return grant;
  }

  async removeGrant(actorId: string, id: string) {
    const scope = await getUserScope(this.prisma, actorId);
    if (!scope.isAdmin) throw new ForbiddenException('Only organization administrators can manage grants');
    const grant = await this.prisma.accessGrant.findUnique({ where: { id } });
    if (!grant || grant.organizationId !== scope.organizationId) throw new NotFoundException('Access grant not found');
    return this.prisma.accessGrant.delete({ where: { id } });
  }
}
