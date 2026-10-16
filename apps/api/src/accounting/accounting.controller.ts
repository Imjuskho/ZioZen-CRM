import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AccountingService } from './accounting.service.js';
import { CreateAccountDto, CreateAccountingPeriodDto, CreateJournalEntryDto, PeriodSignOffDto } from './dto/accounting.dto.js';
import { AddBankTransactionsDto, AssignFinanceExceptionDto, CloseReconciliationSessionDto, CreateFinanceExceptionDto, CreateFinanceExceptionPolicyDto, CreateReconciliationSessionDto, ImportProviderStatementDto, ImportStatementDto, MatchTransactionDto, ResolveFinanceExceptionDto } from './dto/reconciliation.dto.js';
import { ReconciliationService } from './reconciliation.service.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { Permissions } from '../common/permissions.decorator.js';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accounting: AccountingService, private readonly reconciliation: ReconciliationService) {}

  @Get('accounts')
  @Permissions('finance.read')
  accounts(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.accounting.accounts(req.user.userId, departmentId); }

  @Post('accounts')
  @Permissions('finance.write')
  createAccount(@Request() req: { user: { userId: string } }, @Body() dto: CreateAccountDto) { return this.accounting.createAccount(req.user.userId, dto); }

  @Get('journal-entries')
  @Permissions('finance.read')
  journalEntries(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.accounting.journalEntries(req.user.userId, departmentId); }

  @Post('journal-entries')
  @Permissions('finance.write')
  postJournalEntry(@Request() req: { user: { userId: string } }, @Body() dto: CreateJournalEntryDto) { return this.accounting.postJournalEntry(req.user.userId, dto); }

  @Get('trial-balance')
  @Permissions('finance.read')
  trialBalance(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId: string, @Query('from') from?: string, @Query('to') to?: string) { return this.accounting.trialBalance(req.user.userId, departmentId, from, to); }

  @Get('profit-loss')
  @Permissions('finance.read')
  profitLoss(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId: string, @Query('from') from?: string, @Query('to') to?: string) { return this.accounting.profitLoss(req.user.userId, departmentId, from, to); }

  @Get('periods')
  @Permissions('finance.read')
  periods(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.accounting.periods(req.user.userId, departmentId); }

  @Post('periods')
  @Permissions('finance.write')
  createPeriod(@Request() req: { user: { userId: string } }, @Body() dto: CreateAccountingPeriodDto) { return this.accounting.createPeriod(req.user.userId, dto); }

  @Post('periods/:id/close')
  @Permissions('finance.write')
  closePeriod(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.accounting.closePeriod(req.user.userId, id); }

  @Get('periods/:id/close-readiness')
  @Permissions('finance.read')
  closeReadiness(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.accounting.closeReadiness(req.user.userId, id); }

  @Post('periods/:id/sign-off')
  @Permissions('finance.write')
  signOffPeriod(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: PeriodSignOffDto) { return this.accounting.signOffPeriod(req.user.userId, id, dto); }

  @Post('periods/:id/reopen-sign-off')
  @Permissions('finance.write')
  reopenSignOff(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: PeriodSignOffDto) { return this.accounting.reopenSignOff(req.user.userId, id, dto); }

  @Get('reconciliation/sessions')
  @Permissions('finance.read')
  sessions(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.reconciliation.sessions(req.user.userId, departmentId); }

  @Post('reconciliation/sessions')
  @Permissions('finance.write')
  createSession(@Request() req: { user: { userId: string } }, @Body() dto: CreateReconciliationSessionDto) { return this.reconciliation.createSession(req.user.userId, dto); }

  @Post('reconciliation/sessions/:id/transactions')
  @Permissions('finance.write')
  addTransactions(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: AddBankTransactionsDto) { return this.reconciliation.addTransactions(req.user.userId, id, dto); }

  @Post('reconciliation/sessions/:id/import-csv')
  @Permissions('finance.import')
  importCsv(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: ImportStatementDto) { return this.reconciliation.importCsv(req.user.userId, id, dto); }

  @Post('reconciliation/sessions/:id/import')
  @Permissions('finance.import')
  importProvider(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: ImportProviderStatementDto) { return this.reconciliation.importProvider(req.user.userId, id, dto); }

  @Post('reconciliation/transactions/:id/match')
  @Permissions('finance.write')
  match(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: MatchTransactionDto) { return this.reconciliation.match(req.user.userId, id, dto); }

  @Post('reconciliation/transactions/:id/unmatch')
  @Permissions('finance.write')
  unmatch(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.reconciliation.unmatch(req.user.userId, id); }

  @Get('reconciliation/transactions/:id/suggestions')
  @Permissions('finance.read')
  suggestions(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.reconciliation.suggestions(req.user.userId, id); }

  @Post('reconciliation/suggestions/:id/accept')
  @Permissions('finance.write')
  acceptSuggestion(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.reconciliation.acceptSuggestion(req.user.userId, id); }

  @Post('reconciliation/suggestions/:id/reject')
  @Permissions('finance.write')
  rejectSuggestion(@Request() req: { user: { userId: string } }, @Param('id') id: string) { return this.reconciliation.rejectSuggestion(req.user.userId, id); }

  @Post('reconciliation/sessions/:id/close')
  @Permissions('finance.write')
  closeSession(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: CloseReconciliationSessionDto) { return this.reconciliation.closeSession(req.user.userId, id, dto.closingBalance); }

  @Get('exceptions')
  @Permissions('finance.read')
  exceptions(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string, @Query('status') status = 'open') { return this.reconciliation.exceptions(req.user.userId, departmentId, status); }

  @Get('exception-policies')
  @Permissions('finance.read')
  policies(@Request() req: { user: { userId: string } }, @Query('departmentId') departmentId?: string) { return this.reconciliation.policies(req.user.userId, departmentId); }

  @Post('exception-policies')
  @Permissions('finance.write')
  createPolicy(@Request() req: { user: { userId: string } }, @Body() dto: CreateFinanceExceptionPolicyDto) { return this.reconciliation.createPolicy(req.user.userId, dto); }

  @Post('exceptions')
  @Permissions('finance.write')
  createException(@Request() req: { user: { userId: string } }, @Body() dto: CreateFinanceExceptionDto) { return this.reconciliation.createException(req.user.userId, dto); }

  @Post('exceptions/:id/assign')
  @Permissions('finance.write')
  assignException(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: AssignFinanceExceptionDto) { return this.reconciliation.assignException(req.user.userId, id, dto); }

  @Post('exceptions/:id/resolve')
  @Permissions('finance.write')
  resolveException(@Request() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: ResolveFinanceExceptionDto) { return this.reconciliation.resolveException(req.user.userId, id, dto); }
}
