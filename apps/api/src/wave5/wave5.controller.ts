import { Body, Controller, Get, Headers, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AutomationService } from './automation.service.js';
import { InboxService } from './inbox.service.js';
import { AutomationEventDto, CreateAutomationRuleDto, CreateInboxChannelDto, InboundMessageDto } from './wave5.dto.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { Permissions } from '../common/permissions.decorator.js';

@Controller()
export class Wave5Controller {
  constructor(private readonly automation: AutomationService, private readonly inbox: InboxService) {}

  @Permissions('automation.read')
  @Get('automation/rules') @UseGuards(JwtAuthGuard, PermissionsGuard)
  rules(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.automation.rules(req.user.userId, departmentId); }
  @Permissions('automation.manage')
  @Post('automation/rules') @UseGuards(JwtAuthGuard, PermissionsGuard)
  createRule(@Request() req: { user: { userId: string } }, @Body() dto: CreateAutomationRuleDto) { return this.automation.createRule(req.user.userId, dto); }
  @Permissions('automation.read')
  @Get('automation/runs') @UseGuards(JwtAuthGuard, PermissionsGuard)
  runs(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.automation.runs(req.user.userId, departmentId); }
  @Permissions('automation.manage')
  @Post('automation/events') @UseGuards(JwtAuthGuard, PermissionsGuard)
  ingest(@Request() req: { user: { userId: string } }, @Body() dto: AutomationEventDto) { return this.automation.ingest(req.user.userId, dto); }

  @Permissions('automation.manage')
  @Post('automation/runs/:id/replay') @UseGuards(JwtAuthGuard, PermissionsGuard)
  replay(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.automation.retryRun(req.user.userId, id); }

  @Permissions('inbox.manage')
  @Get('inbox/channels') @UseGuards(JwtAuthGuard, PermissionsGuard)
  channels(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.inbox.channels(req.user.userId, departmentId); }
  @Permissions('inbox.manage')
  @Post('inbox/channels') @UseGuards(JwtAuthGuard, PermissionsGuard)
  createChannel(@Request() req: { user: { userId: string } }, @Body() dto: CreateInboxChannelDto) { return this.inbox.createChannel(req.user.userId, dto); }
  @Permissions('inbox.manage')
  @Get('inbox/threads') @UseGuards(JwtAuthGuard, PermissionsGuard)
  threads(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.inbox.threads(req.user.userId, departmentId); }
  @Post('inbox/webhooks/:channel')
  receive(@Param('channel') channel: string, @Headers('x-inbox-secret') secret: string | undefined, @Body() dto: InboundMessageDto) { return this.inbox.receive(channel, secret, dto); }
}
