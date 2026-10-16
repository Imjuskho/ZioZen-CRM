import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AccessService } from './access.service.js';
import { AcceptInvitationDto, CreateAccessGrantDto, CreateInvitationDto, UpdateOrganizationProfileDto } from './access.dto.js';

@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get('organization')
  @UseGuards(JwtAuthGuard)
  organization(@Request() req: { user: { userId: string } }) {
    return this.access.organizationProfile(req.user.userId);
  }

  @Post('organization')
  @UseGuards(JwtAuthGuard)
  updateOrganization(@Request() req: { user: { userId: string } }, @Body() dto: UpdateOrganizationProfileDto) {
    return this.access.updateOrganizationProfile(req.user.userId, dto);
  }

  @Get('invitations')
  @UseGuards(JwtAuthGuard)
  invitations(@Request() req: { user: { userId: string } }) {
    return this.access.invitations(req.user.userId);
  }

  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  invite(@Request() req: { user: { userId: string } }, @Body() dto: CreateInvitationDto) {
    return this.access.createInvitation(req.user.userId, dto);
  }

  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.access.acceptInvitation(token, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  effective(@Request() req: { user: { userId: string } }) {
    return this.access.effectiveAccess(req.user.userId);
  }

  @Get('grants')
  @UseGuards(JwtAuthGuard)
  list(@Request() req: { user: { userId: string } }) {
    return this.access.listGrants(req.user.userId);
  }

  @Post('grants')
  @UseGuards(JwtAuthGuard)
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateAccessGrantDto) {
    return this.access.createGrant(req.user.userId, dto);
  }

  @Delete('grants/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Request() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.access.removeGrant(req.user.userId, id);
  }
}
