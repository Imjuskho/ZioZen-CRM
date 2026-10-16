import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { statementAdapters } from './statement-adapters.js';
import { AddBankTransactionsDto, AssignFinanceExceptionDto, CreateFinanceExceptionDto, CreateFinanceExceptionPolicyDto, CreateReconciliationSessionDto, ImportProviderStatementDto, ImportStatementDto, MatchTransactionDto, ResolveFinanceExceptionDto } from './dto/reconciliation.dto.js';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async sessions(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.reconciliationSession.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { account: true, transactions: { include: { match: true } } }, orderBy: { statementEnd: 'desc' } });
  }

  async createSession(userId: string, dto: CreateReconciliationSessionDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const start = new Date(dto.statementStart);
    const end = new Date(dto.statementEnd);
    if (start >= end) throw new BadRequestException('Statement end must be after statement start');
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException('Reconciliation account not found');
    if (account.departmentId !== dto.departmentId || account.type !== 'ASSET') throw new BadRequestException('Only an asset account in the same department can be reconciled');
    const overlap = await this.prisma.reconciliationSession.findFirst({ where: { accountId: dto.accountId, statementStart: { lt: end }, statementEnd: { gt: start } } });
    if (overlap) throw new ConflictException('Statement period overlaps an existing reconciliation session');
    const session = await this.prisma.reconciliationSession.create({ data: { name: dto.name.trim(), accountId: dto.accountId, departmentId: dto.departmentId, createdById: userId, statementStart: start, statementEnd: end, openingBalance: new Prisma.Decimal(dto.openingBalance) }, include: { account: true, transactions: true } });
    await this.audit.log({ action: 'RECONCILIATION_SESSION_CREATED', entityType: 'ReconciliationSession', entityId: session.id, departmentId: session.departmentId, actorId: userId, metadata: { accountId: session.accountId, statementStart: start.toISOString(), statementEnd: end.toISOString() } });
    return session;
  }

  async addTransactions(userId: string, sessionId: string, dto: AddBankTransactionsDto) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.reconciliationSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Reconciliation session not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, session.departmentId);
      if (session.status !== 'open') throw new ConflictException('Closed reconciliation sessions cannot be changed');
      if (!dto.transactions?.length) throw new BadRequestException('At least one bank transaction is required');
      for (const item of dto.transactions) {
        const date = new Date(item.transactionDate);
        if (date < session.statementStart || date >= session.statementEnd) throw new BadRequestException(`Transaction ${item.externalId} is outside the statement period`);
        await tx.bankTransaction.create({ data: { sessionId, externalId: item.externalId, transactionDate: date, amount: new Prisma.Decimal(item.amount), description: item.description } });
      }
      await this.audit.log({ action: 'BANK_TRANSACTIONS_IMPORTED', entityType: 'ReconciliationSession', entityId: sessionId, departmentId: session.departmentId, actorId: userId, metadata: { count: dto.transactions.length } }, tx);
      return tx.bankTransaction.findMany({ where: { sessionId }, orderBy: { transactionDate: 'asc' } });
    });
  }

  async match(userId: string, transactionId: string, dto: MatchTransactionDto) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.bankTransaction.findUnique({ where: { id: transactionId }, include: { session: true, match: true } });
      if (!transaction) throw new NotFoundException('Bank transaction not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, transaction.session.departmentId);
      if (transaction.session.status !== 'open') throw new ConflictException('Closed reconciliation sessions cannot be changed');
      if (transaction.status !== 'unmatched' || transaction.match) throw new ConflictException('Bank transaction is already matched');
      const entry = await tx.journalEntry.findUnique({ where: { id: dto.journalEntryId }, include: { lines: true, reconciliationMatch: true } });
      if (!entry) throw new NotFoundException('Journal entry not found');
      if (entry.departmentId !== transaction.session.departmentId) throw new BadRequestException('Journal entry and bank transaction departments must match');
      if (entry.reconciliationMatch) throw new ConflictException('Journal entry is already matched');
      if (entry.date < transaction.session.statementStart || entry.date >= transaction.session.statementEnd) throw new BadRequestException('Journal entry is outside the statement period');
      const journalAmount = entry.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
      if (!journalAmount.equals(new Prisma.Decimal(transaction.amount).abs())) throw new BadRequestException(`Amounts do not match: bank ${transaction.amount.toString()}, journal ${journalAmount.toString()}`);
      const match = await tx.reconciliationMatch.create({ data: { bankTransactionId: transaction.id, journalEntryId: entry.id, amount: journalAmount, matchedById: userId } });
      await tx.bankTransaction.update({ where: { id: transaction.id }, data: { status: 'matched' } });
      await this.audit.log({ action: 'BANK_TRANSACTION_MATCHED', entityType: 'ReconciliationMatch', entityId: match.id, departmentId: transaction.session.departmentId, actorId: userId, metadata: { bankTransactionId: transaction.id, journalEntryId: entry.id, amount: journalAmount.toString() } }, tx);
      return match;
    });
  }

  async unmatch(userId: string, transactionId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.bankTransaction.findUnique({ where: { id: transactionId }, include: { session: true, match: true } });
      if (!transaction) throw new NotFoundException('Bank transaction not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, transaction.session.departmentId);
      if (transaction.session.status !== 'open') throw new ConflictException('Closed reconciliation sessions cannot be changed');
      if (!transaction.match) throw new BadRequestException('Bank transaction is not matched');
      await tx.reconciliationMatch.delete({ where: { id: transaction.match.id } });
      const updated = await tx.bankTransaction.update({ where: { id: transaction.id }, data: { status: 'unmatched' } });
      await this.audit.log({ action: 'BANK_TRANSACTION_UNMATCHED', entityType: 'BankTransaction', entityId: transaction.id, departmentId: transaction.session.departmentId, actorId: userId }, tx);
      return updated;
    });
  }

  async closeSession(userId: string, sessionId: string, closingBalance: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.reconciliationSession.findUnique({ where: { id: sessionId }, include: { transactions: true } });
      if (!session) throw new NotFoundException('Reconciliation session not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, session.departmentId);
      if (session.status !== 'open') throw new ConflictException('Reconciliation session is already closed');
      const unmatched = session.transactions.filter((transaction) => transaction.status === 'unmatched');
      if (unmatched.length) throw new ConflictException(`${unmatched.length} bank transaction(s) remain unmatched`);
      const expected = session.openingBalance.add(session.transactions.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)));
      const actual = new Prisma.Decimal(closingBalance);
      if (!expected.equals(actual)) throw new BadRequestException(`Closing balance does not reconcile: expected ${expected.toFixed(2)}`);
      const closed = await tx.reconciliationSession.update({ where: { id: session.id }, data: { status: 'closed', closingBalance: actual, closedAt: new Date() } });
      await this.audit.log({ action: 'RECONCILIATION_SESSION_CLOSED', entityType: 'ReconciliationSession', entityId: session.id, departmentId: session.departmentId, actorId: userId, metadata: { closingBalance: actual.toString() } }, tx);
      return closed;
    });
  }

  async exceptions(userId: string, departmentId?: string, status = 'open') {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    const departments = departmentId ? [departmentId] : scope.departmentIds;
    await this.refreshExceptions(departments);
    await this.escalateAgedExceptions(departments);
    return this.prisma.financeException.findMany({ where: { departmentId: { in: departments }, ...(status ? { status } : {}) }, include: { assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }] });
  }

  async policies(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.financeExceptionPolicy.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { assignee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { thresholdHours: 'asc' } });
  }

  async createPolicy(userId: string, dto: CreateFinanceExceptionPolicyDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    if (dto.assigneeId) {
      const membership = await this.prisma.userDepartment.findUnique({ where: { userId_departmentId: { userId: dto.assigneeId, departmentId: dto.departmentId } } });
      if (!membership) throw new BadRequestException('Policy assignee must belong to the policy department');
    }
    const policy = await this.prisma.financeExceptionPolicy.create({ data: { departmentId: dto.departmentId, type: dto.type, severity: dto.severity, thresholdHours: dto.thresholdHours, assigneeId: dto.assigneeId } });
    await this.audit.log({ action: 'FINANCE_EXCEPTION_POLICY_CREATED', entityType: 'FinanceExceptionPolicy', entityId: policy.id, departmentId: policy.departmentId, actorId: userId, metadata: { thresholdHours: policy.thresholdHours, type: policy.type, severity: policy.severity } });
    return policy;
  }

  async createException(userId: string, dto: CreateFinanceExceptionDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const exception = await this.prisma.financeException.create({ data: { departmentId: dto.departmentId, type: dto.type, severity: dto.severity ?? 'medium', title: dto.title, detail: dto.detail, entityType: dto.entityType, entityId: dto.entityId } });
    await this.audit.log({ action: 'FINANCE_EXCEPTION_CREATED', entityType: 'FinanceException', entityId: exception.id, departmentId: exception.departmentId, actorId: userId, metadata: { type: exception.type, severity: exception.severity } });
    return exception;
  }

  async assignException(userId: string, exceptionId: string, dto: AssignFinanceExceptionDto) {
    const scope = await getUserScope(this.prisma, userId);
    const exception = await this.prisma.financeException.findUnique({ where: { id: exceptionId } });
    if (!exception) throw new NotFoundException('Finance exception not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, exception.departmentId);
    const assignee = await this.prisma.userDepartment.findUnique({ where: { userId_departmentId: { userId: dto.assigneeId, departmentId: exception.departmentId } } });
    if (!assignee) throw new BadRequestException('Assignee must belong to the exception department');
    return this.prisma.financeException.update({ where: { id: exception.id }, data: { assigneeId: dto.assigneeId } });
  }

  async resolveException(userId: string, exceptionId: string, dto: ResolveFinanceExceptionDto) {
    const scope = await getUserScope(this.prisma, userId);
    const exception = await this.prisma.financeException.findUnique({ where: { id: exceptionId } });
    if (!exception) throw new NotFoundException('Finance exception not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, exception.departmentId);
    if (exception.status === 'resolved') throw new ConflictException('Finance exception is already resolved');
    const resolved = await this.prisma.financeException.update({ where: { id: exception.id }, data: { status: 'resolved', resolvedAt: new Date(), resolvedById: userId, resolutionNote: dto.resolutionNote } });
    await this.audit.log({ action: 'FINANCE_EXCEPTION_RESOLVED', entityType: 'FinanceException', entityId: exception.id, departmentId: exception.departmentId, actorId: userId, metadata: { resolutionNote: dto.resolutionNote } });
    return resolved;
  }

  async importProvider(userId: string, sessionId: string, dto: ImportProviderStatementDto) {
    const adapter = statementAdapters[dto.provider.toLowerCase()];
    if (!adapter) throw new BadRequestException(`Unsupported statement provider: ${dto.provider}`);
    return this.importRows(userId, sessionId, adapter.parse(dto.csv), adapter.provider);
  }

  async importCsv(userId: string, sessionId: string, dto: ImportStatementDto) {
    return this.importProvider(userId, sessionId, { provider: 'csv', csv: dto.csv });
  }

  private async importRows(userId: string, sessionId: string, rows: Array<{ externalId: string; transactionDate: string; amount: string; description?: string; rawData: Record<string, string> }>, provider: string) {
    const scope = await getUserScope(this.prisma, userId);
    const session = await this.prisma.reconciliationSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Reconciliation session not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, session.departmentId);
    if (session.status !== 'open') throw new ConflictException('Closed reconciliation sessions cannot be changed');
    if (!rows.length) throw new BadRequestException('Statement contains no transactions');
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const date = new Date(row.transactionDate);
        if (Number.isNaN(date.getTime()) || date < session.statementStart || date >= session.statementEnd) throw new BadRequestException(`Transaction ${row.externalId} has an invalid or out-of-period date`);
        await tx.bankTransaction.create({ data: { sessionId, externalId: row.externalId, transactionDate: date, amount: new Prisma.Decimal(row.amount), description: row.description, source: provider, rawData: row.rawData } });
      }
      await this.audit.log({ action: 'BANK_STATEMENT_IMPORTED', entityType: 'ReconciliationSession', entityId: sessionId, departmentId: session.departmentId, actorId: userId, metadata: { provider, count: rows.length } }, tx);
      return tx.bankTransaction.findMany({ where: { sessionId }, orderBy: { transactionDate: 'asc' } });
    });
  }

  async suggestions(userId: string, transactionId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const transaction = await this.prisma.bankTransaction.findUnique({ where: { id: transactionId }, include: { session: true } });
    if (!transaction) throw new NotFoundException('Bank transaction not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, transaction.session.departmentId);
    if (transaction.status !== 'unmatched') throw new ConflictException('Suggestions are only available for unmatched transactions');
    const entries = await this.prisma.journalEntry.findMany({ where: { departmentId: transaction.session.departmentId, date: { gte: transaction.session.statementStart, lt: transaction.session.statementEnd }, reconciliationMatch: null }, include: { lines: true }, orderBy: { date: 'desc' }, take: 200 });
    const amount = new Prisma.Decimal(transaction.amount).abs();
    const ranked = entries.map((entry) => {
      const entryAmount = entry.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
      const days = Math.abs(entry.date.getTime() - transaction.transactionDate.getTime()) / 86400000;
      const amountMatch = entryAmount.equals(amount);
      const dateMatch = days <= 3;
      const score = (amountMatch ? 70 : 0) + (dateMatch ? Math.max(0, 20 - Math.floor(days * 5)) : 0);
      return { entry, entryAmount, score, reason: `${amountMatch ? 'Exact amount' : 'Amount differs'}; ${dateMatch ? `date within ${Math.ceil(days)} day(s)` : 'date outside 3-day window'}` };
    }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    for (const candidate of ranked) await this.prisma.reconciliationSuggestion.upsert({ where: { bankTransactionId_journalEntryId: { bankTransactionId: transaction.id, journalEntryId: candidate.entry.id } }, update: { score: candidate.score, reason: candidate.reason }, create: { bankTransactionId: transaction.id, journalEntryId: candidate.entry.id, score: candidate.score, reason: candidate.reason } });
    return this.prisma.reconciliationSuggestion.findMany({ where: { bankTransactionId: transaction.id, status: 'pending' }, include: { journalEntry: { include: { lines: true } } }, orderBy: { score: 'desc' } });
  }

  async acceptSuggestion(userId: string, suggestionId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.reconciliationSuggestion.findUnique({ where: { id: suggestionId }, include: { bankTransaction: { include: { session: true } }, journalEntry: { include: { lines: true, reconciliationMatch: true } } } });
      if (!suggestion) throw new NotFoundException('Reconciliation suggestion not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, suggestion.bankTransaction.session.departmentId);
      if (suggestion.status !== 'pending') throw new ConflictException('Suggestion has already been decided');
      if (suggestion.bankTransaction.status !== 'unmatched' || suggestion.journalEntry.reconciliationMatch) throw new ConflictException('Transaction or journal entry is already matched');
      const amount = suggestion.journalEntry.lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
      if (!amount.equals(new Prisma.Decimal(suggestion.bankTransaction.amount).abs())) throw new BadRequestException('Suggestion amount is no longer an exact match');
      const match = await tx.reconciliationMatch.create({ data: { bankTransactionId: suggestion.bankTransactionId, journalEntryId: suggestion.journalEntryId, amount, matchedById: userId } });
      await tx.bankTransaction.update({ where: { id: suggestion.bankTransactionId }, data: { status: 'matched' } });
      await tx.reconciliationSuggestion.update({ where: { id: suggestion.id }, data: { status: 'accepted', decidedById: userId, decidedAt: new Date() } });
      await this.audit.log({ action: 'RECONCILIATION_SUGGESTION_ACCEPTED', entityType: 'ReconciliationSuggestion', entityId: suggestion.id, departmentId: suggestion.bankTransaction.session.departmentId, actorId: userId, metadata: { matchId: match.id } }, tx);
      return match;
    });
  }

  async rejectSuggestion(userId: string, suggestionId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const suggestion = await this.prisma.reconciliationSuggestion.findUnique({ where: { id: suggestionId }, include: { bankTransaction: { include: { session: true } } } });
    if (!suggestion) throw new NotFoundException('Reconciliation suggestion not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, suggestion.bankTransaction.session.departmentId);
    if (suggestion.status !== 'pending') throw new ConflictException('Suggestion has already been decided');
    const rejected = await this.prisma.reconciliationSuggestion.update({ where: { id: suggestion.id }, data: { status: 'rejected', decidedById: userId, decidedAt: new Date() } });
    await this.audit.log({ action: 'RECONCILIATION_SUGGESTION_REJECTED', entityType: 'ReconciliationSuggestion', entityId: suggestion.id, departmentId: suggestion.bankTransaction.session.departmentId, actorId: userId });
    return rejected;
  }

  private parseCsv(csv: string) {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
    const dateIndex = headers.findIndex((header) => ['date', 'transactiondate', 'transaction_date'].includes(header));
    const amountIndex = headers.findIndex((header) => header === 'amount');
    const idIndex = headers.findIndex((header) => ['id', 'externalid', 'external_id', 'reference'].includes(header));
    const descriptionIndex = headers.findIndex((header) => ['description', 'memo', 'details'].includes(header));
    if (dateIndex < 0 || amountIndex < 0 || idIndex < 0) throw new BadRequestException('CSV must contain date, amount, and externalId/reference columns');
    return lines.slice(1).map((line, index) => {
      const values = this.parseCsvLine(line);
      const rawAmount = values[amountIndex]?.replace(/[$,\s]/g, '');
      if (!rawAmount || !values[idIndex]) throw new BadRequestException(`CSV row ${index + 2} is missing an id or amount`);
      return { externalId: values[idIndex], transactionDate: values[dateIndex], amount: rawAmount, description: descriptionIndex >= 0 ? values[descriptionIndex] : undefined, rawData: Object.fromEntries(headers.map((header, i) => [header || `column_${i}`, values[i] ?? ''])) };
    });
  }

  private async escalateAgedExceptions(departmentIds: string[]) {
    const [policies, exceptions] = await Promise.all([
      this.prisma.financeExceptionPolicy.findMany({ where: { departmentId: { in: departmentIds }, active: true }, orderBy: { thresholdHours: 'asc' } }),
      this.prisma.financeException.findMany({ where: { departmentId: { in: departmentIds }, status: 'open' } }),
    ]);
    const now = Date.now();
    for (const exception of exceptions) {
      const policy = policies.find((item) => (!item.type || item.type === exception.type) && (!item.severity || item.severity === exception.severity) && now - exception.createdAt.getTime() >= item.thresholdHours * 3600000);
      if (!policy || exception.escalatedAt) continue;
      const updated = await this.prisma.financeException.update({ where: { id: exception.id }, data: { escalationLevel: { increment: 1 }, escalatedAt: new Date(), escalatedToId: policy.assigneeId } });
      await this.audit.log({ action: 'FINANCE_EXCEPTION_ESCALATED', entityType: 'FinanceException', entityId: exception.id, departmentId: exception.departmentId, metadata: { escalationLevel: updated.escalationLevel, thresholdHours: policy.thresholdHours, assigneeId: policy.assigneeId } });
    }
  }

  private parseCsvLine(line: string) {
    const values: string[] = [];
    let current = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(current.trim()); current = ''; } else current += char; }
    values.push(current.trim());
    return values;
  }

  private async refreshExceptions(departmentIds: string[]) {
    const sessions = await this.prisma.reconciliationSession.findMany({ where: { departmentId: { in: departmentIds }, status: 'open' }, include: { transactions: true } });
    for (const session of sessions) for (const transaction of session.transactions.filter((item) => item.status === 'unmatched')) await this.ensureException({ departmentId: session.departmentId, type: 'UNMATCHED_BANK_TRANSACTION', severity: 'high', title: `Unmatched bank transaction ${transaction.externalId}`, detail: transaction.description ?? `Bank transaction for ${transaction.amount.toString()}`, entityType: 'BankTransaction', entityId: transaction.id });
    const overdue = await this.prisma.invoice.findMany({ where: { departmentId: { in: departmentIds }, status: 'overdue' } });
    for (const invoice of overdue) await this.ensureException({ departmentId: invoice.departmentId, type: 'OVERDUE_INVOICE', severity: 'medium', title: `Overdue invoice ${invoice.number}`, detail: `Invoice amount ${invoice.amount.toString()} requires collection follow-up`, entityType: 'Invoice', entityId: invoice.id });
  }

  private async ensureException(data: { departmentId: string; type: string; severity: string; title: string; detail: string; entityType: string; entityId: string }) {
    const existing = await this.prisma.financeException.findFirst({ where: { type: data.type, entityType: data.entityType, entityId: data.entityId, status: 'open' } });
    if (!existing) await this.prisma.financeException.create({ data });
  }
}
