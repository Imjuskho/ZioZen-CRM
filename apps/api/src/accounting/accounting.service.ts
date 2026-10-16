import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { CreateAccountDto, CreateAccountingPeriodDto, CreateJournalEntryDto, PeriodSignOffDto } from './dto/accounting.dto.js';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async accounts(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.account.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, orderBy: { code: 'asc' } });
  }

  async createAccount(userId: string, dto: CreateAccountDto) {
    const scope = await getUserScope(this.prisma, userId);
    const departmentId = dto.departmentId;
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    try {
      const account = await this.prisma.account.create({ data: { code: dto.code, name: dto.name.trim(), type: dto.type as AccountType, currency: dto.currency ?? 'USD', description: dto.description, departmentId } });
      await this.audit.log({ action: 'ACCOUNT_CREATED', entityType: 'Account', entityId: account.id, departmentId, actorId: userId, metadata: { code: account.code, type: account.type } });
      return account;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Account code already exists in this department');
      throw error;
    }
  }

  async postJournalEntry(userId: string, dto: CreateJournalEntryDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    if (!dto.lines || dto.lines.length < 2) throw new BadRequestException('A journal entry requires at least two lines');
    const normalized = dto.lines.map((line) => {
      const debit = new Prisma.Decimal(line.debit ?? 0);
      const credit = new Prisma.Decimal(line.credit ?? 0);
      if (debit.lt(0) || credit.lt(0) || (debit.gt(0) && credit.gt(0)) || (debit.isZero() && credit.isZero())) throw new BadRequestException('Each journal line must have either a positive debit or credit');
      return { accountId: line.accountId, debit, credit };
    });
    const totalDebit = normalized.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
    const totalCredit = normalized.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));
    if (totalDebit.isZero() || !totalDebit.equals(totalCredit)) throw new BadRequestException(`Journal entry must balance: debits ${totalDebit.toFixed(2)}, credits ${totalCredit.toFixed(2)}`);
    return this.prisma.$transaction(async (tx) => {
      const entryDate = dto.date ? new Date(dto.date) : new Date();
      const period = await this.assertOpenPeriod(tx, dto.departmentId, entryDate);
      const accounts = await tx.account.findMany({ where: { id: { in: normalized.map((line) => line.accountId) } } });
      if (accounts.length !== new Set(normalized.map((line) => line.accountId)).size) throw new NotFoundException('One or more accounts were not found');
      if (accounts.some((account) => account.departmentId !== dto.departmentId || !account.active)) throw new BadRequestException('All accounts must be active and belong to the journal department');
      let entry;
      try {
        entry = await tx.journalEntry.create({ data: { number: dto.number, date: entryDate, memo: dto.memo, departmentId: dto.departmentId, postedById: userId, accountingPeriodId: period?.id, lines: { create: normalized } }, include: { lines: { include: { account: true } }, department: true } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Journal entry number already exists');
        throw error;
      }
      await this.audit.log({ action: 'JOURNAL_ENTRY_POSTED', entityType: 'JournalEntry', entityId: entry.id, departmentId: dto.departmentId, actorId: userId, metadata: { number: entry.number, total: totalDebit.toString(), lineCount: normalized.length } }, tx);
      return { ...entry, totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString() };
    });
  }

  async journalEntries(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.journalEntry.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { lines: { include: { account: true } }, postedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 100 });
  }

  async trialBalance(userId: string, departmentId: string, from?: string, to?: string) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    const date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const accounts = await this.prisma.account.findMany({ where: { departmentId }, include: { journalLines: { where: { journalEntry: { departmentId, ...(Object.keys(date).length ? { date } : {}) } } } }, orderBy: { code: 'asc' } });
    const rows = accounts.map((account) => {
      const debit = account.journalLines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
      const credit = account.journalLines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));
      return { accountId: account.id, code: account.code, name: account.name, type: account.type, debit: debit.toString(), credit: credit.toString(), balance: debit.minus(credit).toString() };
    });
    const totalDebit = rows.reduce((sum, row) => sum.add(row.debit), new Prisma.Decimal(0));
    const totalCredit = rows.reduce((sum, row) => sum.add(row.credit), new Prisma.Decimal(0));
    return { departmentId, from: from ?? null, to: to ?? null, rows, totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString(), balanced: totalDebit.equals(totalCredit) };
  }

  async profitLoss(userId: string, departmentId: string, from?: string, to?: string) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    const date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const accounts = await this.prisma.account.findMany({ where: { departmentId, type: { in: [AccountType.REVENUE, AccountType.EXPENSE] } }, include: { journalLines: { where: { journalEntry: { departmentId, ...(Object.keys(date).length ? { date } : {}) } } } }, orderBy: { code: 'asc' } });
    const rows = accounts.map((account) => {
      const debit = account.journalLines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
      const credit = account.journalLines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));
      const balance = account.type === AccountType.REVENUE ? credit.minus(debit) : debit.minus(credit);
      return { accountId: account.id, code: account.code, name: account.name, type: account.type, debit: debit.toString(), credit: credit.toString(), balance: balance.toString() };
    });
    const revenue = rows.filter((row) => row.type === AccountType.REVENUE).reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const expenses = rows.filter((row) => row.type === AccountType.EXPENSE).reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    return { departmentId, from: from ?? null, to: to ?? null, revenue: revenue.toString(), expenses: expenses.toString(), netProfit: revenue.minus(expenses).toString(), rows };
  }

  async periods(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.accountingPeriod.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, orderBy: [{ startDate: 'desc' }, { name: 'asc' }] });
  }

  async createPeriod(userId: string, dto: CreateAccountingPeriodDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate >= endDate) throw new BadRequestException('Period end date must be after start date');
    const overlap = await this.prisma.accountingPeriod.findFirst({ where: { departmentId: dto.departmentId, startDate: { lt: endDate }, endDate: { gt: startDate } } });
    if (overlap) throw new ConflictException('Accounting period overlaps an existing period');
    const period = await this.prisma.accountingPeriod.create({ data: { departmentId: dto.departmentId, name: dto.name.trim(), startDate, endDate } });
    await this.audit.log({ action: 'ACCOUNTING_PERIOD_CREATED', entityType: 'AccountingPeriod', entityId: period.id, departmentId: period.departmentId, actorId: userId, metadata: { name: period.name } });
    return period;
  }

  async closeReadiness(userId: string, periodId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const period = await this.prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Accounting period not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, period.departmentId);
    const [openExceptions, sessions, unassignedJournals, overdueInvoices] = await Promise.all([
      this.prisma.financeException.count({ where: { departmentId: period.departmentId, status: 'open', createdAt: { lte: period.endDate } } }),
      this.prisma.reconciliationSession.findMany({ where: { departmentId: period.departmentId, statementEnd: { gt: period.startDate, lte: period.endDate }, status: 'open' }, include: { transactions: { where: { status: 'unmatched' }, select: { id: true } } } }),
      this.prisma.journalEntry.count({ where: { departmentId: period.departmentId, accountingPeriodId: null, date: { gte: period.startDate, lt: period.endDate } } }),
      this.prisma.invoice.count({ where: { departmentId: period.departmentId, status: 'overdue', createdAt: { gte: period.startDate, lt: period.endDate } } }),
    ]);
    const openReconciliations = sessions.length;
    const unmatchedTransactions = sessions.reduce((sum, session) => sum + session.transactions.length, 0);
    const checks = {
      openExceptions: { count: openExceptions, blocking: openExceptions > 0 },
      openReconciliations: { count: openReconciliations, blocking: openReconciliations > 0 },
      unmatchedTransactions: { count: unmatchedTransactions, blocking: unmatchedTransactions > 0 },
      unassignedJournals: { count: unassignedJournals, blocking: false },
      overdueInvoices: { count: overdueInvoices, blocking: false },
    };
    return { periodId, departmentId: period.departmentId, status: period.status, ready: Object.values(checks).every((check) => !check.blocking), checks };
  }

  async signOffPeriod(userId: string, periodId: string, dto: PeriodSignOffDto) {
    const readiness = await this.closeReadiness(userId, periodId);
    if (!readiness.ready) throw new ConflictException({ message: 'Period is not ready for sign-off', readiness });
    const period = await this.prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.status === 'closed') throw new ConflictException('Closed periods cannot be signed off');
    const signOff = await this.prisma.periodSignOff.create({ data: { accountingPeriodId: periodId, status: 'signed', actorId: userId, note: dto.note, snapshot: readiness } });
    await this.audit.log({ action: 'ACCOUNTING_PERIOD_SIGNED_OFF', entityType: 'PeriodSignOff', entityId: signOff.id, departmentId: period.departmentId, actorId: userId, metadata: { periodId, readiness } });
    return signOff;
  }

  async reopenSignOff(userId: string, periodId: string, dto: PeriodSignOffDto) {
    const scope = await getUserScope(this.prisma, userId);
    const period = await this.prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Accounting period not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, period.departmentId);
    if (period.status === 'closed') throw new ConflictException('Closed periods cannot be reopened through sign-off');
    const event = await this.prisma.periodSignOff.create({ data: { accountingPeriodId: periodId, status: 'reopened', actorId: userId, note: dto.note, snapshot: { reason: dto.note ?? 'Reopened for review' } } });
    await this.audit.log({ action: 'ACCOUNTING_PERIOD_SIGN_OFF_REOPENED', entityType: 'PeriodSignOff', entityId: event.id, departmentId: period.departmentId, actorId: userId, metadata: { periodId } });
    return event;
  }

  async closePeriod(userId: string, periodId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const signOff = await this.prisma.periodSignOff.findFirst({ where: { accountingPeriodId: periodId }, orderBy: { createdAt: 'desc' } });
    if (!signOff || signOff.status !== 'signed') throw new ConflictException('Period requires a completed close-readiness sign-off before closing');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "AccountingPeriod" WHERE id = ${periodId} FOR UPDATE`);
      const period = await tx.accountingPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new NotFoundException('Accounting period not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, period.departmentId);
      if (period.status === 'closed') throw new ConflictException('Accounting period is already closed');
      const closed = await tx.accountingPeriod.update({ where: { id: period.id }, data: { status: 'closed', closedAt: new Date(), closedById: userId } });
      await this.audit.log({ action: 'ACCOUNTING_PERIOD_CLOSED', entityType: 'AccountingPeriod', entityId: period.id, departmentId: period.departmentId, actorId: userId, metadata: { name: period.name } }, tx);
      return closed;
    });
  }

  async postInvoiceIssued(tx: Prisma.TransactionClient, input: { invoiceId: string; number: string; amount: Prisma.Decimal; currency: string; departmentId: string; actorId: string }) {
    const accounts = await this.ensurePostingAccounts(tx, input.departmentId, input.currency);
    const period = await this.assertOpenPeriod(tx, input.departmentId, new Date());
    const entry = await tx.journalEntry.create({ data: { number: `JE-INV-${input.invoiceId}`, memo: `Invoice ${input.number} issued`, departmentId: input.departmentId, postedById: input.actorId, accountingPeriodId: period?.id, lines: { create: [{ accountId: accounts.receivable.id, debit: input.amount, credit: new Prisma.Decimal(0) }, { accountId: accounts.revenue.id, debit: new Prisma.Decimal(0), credit: input.amount }] } } });
    await this.audit.log({ action: 'INVOICE_AUTO_JOURNALED', entityType: 'JournalEntry', entityId: entry.id, departmentId: input.departmentId, actorId: input.actorId, metadata: { invoiceId: input.invoiceId, amount: input.amount.toString() } }, tx);
    return entry;
  }

  async postPaymentReceived(tx: Prisma.TransactionClient, input: { paymentId: string; invoiceNumber: string; amount: Prisma.Decimal; currency: string; departmentId: string; actorId: string }) {
    const accounts = await this.ensurePostingAccounts(tx, input.departmentId, input.currency);
    const period = await this.assertOpenPeriod(tx, input.departmentId, new Date());
    const entry = await tx.journalEntry.create({ data: { number: `JE-PAY-${input.paymentId}`, memo: `Payment for invoice ${input.invoiceNumber}`, departmentId: input.departmentId, postedById: input.actorId, accountingPeriodId: period?.id, lines: { create: [{ accountId: accounts.cash.id, debit: input.amount, credit: new Prisma.Decimal(0) }, { accountId: accounts.receivable.id, debit: new Prisma.Decimal(0), credit: input.amount }] } } });
    await this.audit.log({ action: 'PAYMENT_AUTO_JOURNALED', entityType: 'JournalEntry', entityId: entry.id, departmentId: input.departmentId, actorId: input.actorId, metadata: { paymentId: input.paymentId, amount: input.amount.toString() } }, tx);
    return entry;
  }

  async postCreditNoteIssued(tx: Prisma.TransactionClient, input: { creditNoteId: string; number: string; amount: Prisma.Decimal; currency: string; departmentId: string; actorId: string }) {
    const accounts = await this.ensurePostingAccounts(tx, input.departmentId, input.currency);
    const period = await this.assertOpenPeriod(tx, input.departmentId, new Date());
    const entry = await tx.journalEntry.create({ data: { number: `JE-CN-${input.creditNoteId}`, memo: `Credit note ${input.number} issued`, departmentId: input.departmentId, postedById: input.actorId, accountingPeriodId: period?.id, lines: { create: [{ accountId: accounts.revenue.id, debit: input.amount, credit: new Prisma.Decimal(0) }, { accountId: accounts.receivable.id, debit: new Prisma.Decimal(0), credit: input.amount }] } } });
    await this.audit.log({ action: 'CREDIT_NOTE_AUTO_JOURNALED', entityType: 'JournalEntry', entityId: entry.id, departmentId: input.departmentId, actorId: input.actorId, metadata: { creditNoteId: input.creditNoteId, amount: input.amount.toString() } }, tx);
    return entry;
  }

  async reverseCreditNoteJournal(tx: Prisma.TransactionClient, input: { creditNoteId: string; number: string; departmentId: string; actorId: string }) {
    const original = await tx.journalEntry.findUnique({ where: { number: `JE-CN-${input.creditNoteId}` }, include: { lines: true } });
    if (!original) throw new NotFoundException('Credit note journal entry not found');
    const period = await this.assertOpenPeriod(tx, input.departmentId, new Date());
    const reversal = await tx.journalEntry.create({ data: { number: `JE-REV-CN-${input.creditNoteId}`, memo: `Reversal of credit note ${input.number}`, departmentId: input.departmentId, postedById: input.actorId, accountingPeriodId: period?.id, reversalOfId: original.id, lines: { create: original.lines.map((line) => ({ accountId: line.accountId, debit: line.credit, credit: line.debit })) } } });
    await this.audit.log({ action: 'CREDIT_NOTE_REVERSED', entityType: 'JournalEntry', entityId: reversal.id, departmentId: input.departmentId, actorId: input.actorId, metadata: { creditNoteId: input.creditNoteId, originalJournalEntryId: original.id } }, tx);
    return reversal;
  }

  private async assertOpenPeriod(tx: Prisma.TransactionClient, departmentId: string, date: Date) {
    const period = await tx.accountingPeriod.findFirst({ where: { departmentId, startDate: { lte: date }, endDate: { gt: date } }, orderBy: { startDate: 'desc' } });
    if (period?.status === 'closed') throw new ConflictException(`Accounting period ${period.name} is closed`);
    return period;
  }

  private async ensurePostingAccounts(tx: Prisma.TransactionClient, departmentId: string, currency: string) {
    const [cash, receivable, revenue] = await Promise.all([
      tx.account.upsert({ where: { departmentId_code: { departmentId, code: '1000' } }, update: { active: true }, create: { departmentId, code: '1000', name: 'Cash', type: AccountType.ASSET, currency } }),
      tx.account.upsert({ where: { departmentId_code: { departmentId, code: '1100' } }, update: { active: true }, create: { departmentId, code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET, currency } }),
      tx.account.upsert({ where: { departmentId_code: { departmentId, code: '4000' } }, update: { active: true }, create: { departmentId, code: '4000', name: 'Service Revenue', type: AccountType.REVENUE, currency } }),
    ]);
    return { cash, receivable, revenue };
  }
}
