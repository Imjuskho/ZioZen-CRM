import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: configService.getOrThrow<string>('JWT_SECRET') });
  }

  async validate(payload: { sub: string; email: string; sid?: string }) {
    if (!payload.sid) throw new UnauthorizedException('Session is no longer valid');
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Session is revoked or expired');
    void this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { userId: payload.sub, email: payload.email, sessionId: payload.sid };
  }
}
