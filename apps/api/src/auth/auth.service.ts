import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService, private readonly configService: ConfigService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new UnauthorizedException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const organization = await this.prisma.organization.create({ data: { name: dto.organizationName ?? `${dto.firstName} ${dto.lastName} Workspace`, slug: `workspace-${randomUUID()}` } });
    const user = await this.prisma.user.create({ data: { email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName, organizationId: organization.id } });
    return await this.issueToken(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) return null;
    if (!(await bcrypt.compare(password, user.passwordHash))) return null;
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return await this.issueToken(user);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true, memberships: { include: { department: true } }, accessGrants: true } });
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({ where: { userId }, select: { id: true, deviceLabel: true, ipAddress: true, userAgent: true, lastSeenAt: true, expiresAt: true, revokedAt: true, createdAt: true }, orderBy: { lastSeenAt: 'desc' } });
  }

  async revokeSession(userId: string, sessionId: string) {
    return this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllSessions(userId: string) {
    return this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueToken(user: { id: string; email: string; organizationId?: string | null }) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.session.create({ data: { id: sessionId, userId: user.id, organizationId: user.organizationId ?? undefined, expiresAt } });
    const payload = { sub: user.id, email: user.email, organizationId: user.organizationId ?? undefined, sid: sessionId };
    return { accessToken: this.jwtService.sign(payload, { secret: this.configService.getOrThrow<string>('JWT_SECRET'), expiresIn: '8h' }), tokenType: 'Bearer', sessionId, expiresAt };
  }
}
