import { Body, Controller, Get, Param, Post, Req, Request, UseGuards } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service.js';
import { CustomerPortalGuard } from './customer-portal.guard.js';
import type { CustomerPortalRequest } from './customer-portal.guard.js';
import { CustomerLoginDto, CustomerPortalProvisionDto, CustomerPortalReplyDto, CustomerPortalResetPasswordDto, CustomerPortalStateDto, CustomerPortalTicketDto } from './dto/customer-portal.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';

@Controller()
export class CustomerPortalController {
  constructor(private readonly service: CustomerPortalService) {}

  @Post('auth/customer-login')
  login(@Body() dto: CustomerLoginDto) { return this.service.login(dto); }

  @UseGuards(CustomerPortalGuard)
  @Get('customer-portal/projects')
  projects(@Req() req: CustomerPortalRequest) { return this.service.projects(req.portal!.customerId); }

  @UseGuards(CustomerPortalGuard)
  @Get('customer-portal/invoices')
  invoices(@Req() req: CustomerPortalRequest) { return this.service.invoices(req.portal!.customerId); }

  @UseGuards(CustomerPortalGuard)
  @Get('customer-portal/invoices/:id/html')
  invoiceHtml(@Req() req: CustomerPortalRequest, @Param('id') id: string) { return this.service.invoiceHtml(req.portal!.customerId, id); }

  @UseGuards(CustomerPortalGuard)
  @Get('customer-portal/invoices/:id/document')
  invoiceDocument(@Req() req: CustomerPortalRequest, @Param('id') id: string) { return this.service.invoiceHtml(req.portal!.customerId, id); }

  @UseGuards(CustomerPortalGuard)
  @Get('customer-portal/tickets')
  tickets(@Req() req: CustomerPortalRequest) { return this.service.tickets(req.portal!.customerId); }

  @UseGuards(CustomerPortalGuard)
  @Post('customer-portal/tickets')
  createTicket(@Req() req: CustomerPortalRequest, @Body() dto: CustomerPortalTicketDto) { return this.service.createTicket(req.portal!.customerId, dto); }

  @UseGuards(CustomerPortalGuard)
  @Post('customer-portal/tickets/:id/replies')
  reply(@Req() req: CustomerPortalRequest, @Param('id') id: string, @Body() dto: CustomerPortalReplyDto) { return this.service.reply(req.portal!.customerId, id, dto); }


  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('customer-portal/admin/accounts/:customerId')
  accountStatus(@Request() req: { user: { userId: string } }, @Param('customerId') customerId: string) {
    return this.service.accountStatus(req.user.userId, customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Post('customer-portal/admin/accounts/:customerId')
  provisionAccount(
    @Request() req: { user: { userId: string } },
    @Param('customerId') customerId: string,
    @Body() dto: CustomerPortalProvisionDto,
  ) {
    return this.service.provisionAccount(req.user.userId, customerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Post('customer-portal/admin/accounts/:customerId/state')
  setAccountState(
    @Request() req: { user: { userId: string } },
    @Param('customerId') customerId: string,
    @Body() dto: CustomerPortalStateDto,
  ) {
    return this.service.setAccountState(req.user.userId, customerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Post('customer-portal/admin/accounts/:customerId/password')
  resetPassword(
    @Request() req: { user: { userId: string } },
    @Param('customerId') customerId: string,
    @Body() dto: CustomerPortalResetPasswordDto,
  ) {
    return this.service.resetAccountPassword(req.user.userId, customerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Post('customer-portal/admin/accounts/:customerId/delete')
  deleteAccount(@Request() req: { user: { userId: string } }, @Param('customerId') customerId: string) {
    return this.service.deleteAccount(req.user.userId, customerId);
  }

}
