import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type CustomerPortalRequest = {
  portal?: { customerId: string; email: string };
};

@Injectable()
export class CustomerPortalGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CustomerPortalRequest & { headers: { authorization?: string } }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Customer portal authentication required');
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; portal?: boolean }>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (!payload.portal || !payload.sub || !payload.email) throw new Error('Invalid portal token');
      request.portal = { customerId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired customer portal token');
    }
  }
}
