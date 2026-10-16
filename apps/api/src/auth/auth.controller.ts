import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: { user: { userId: string } }) {
    return this.authService.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@Request() req: { user: { userId: string } }) { return this.authService.listSessions(req.user.userId); }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revoke(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.authService.revokeSession(req.user.userId, id); }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-all')
  revokeAll(@Request() req: { user: { userId: string } }) { return this.authService.revokeAllSessions(req.user.userId); }
}
