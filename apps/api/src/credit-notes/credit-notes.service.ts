import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';
import { ApplyCreditNoteDto, CreateCreditNoteDto } from './dto/credit-note.dto.js';
import { AccountingService } from '../accounting/accounting.service.js';

@Injectable()
export class CreditNotesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly accounting: AccountingService) {}

  async findAll(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const notes = await this.prisma.creditNote.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: true, customer: true, applications: true }, orderBy: { createdAt: 'desc' } });
    return notes.map((note) => this.withBalance(note));
  }

  async create(userId: string, dto: CreateCreditNoteDto) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const total = new Prisma.Decimal(dto.total);
    if (total.lte(0)) throw new BadRequestException('Credit note total must be greater than zero');
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { departmentId: true } });
      if (!customer) throw new NotFoundException('Customer not found');
      if (customer.departmentId !== dto.departmentId) throw new BadRequestException('Customer and credit note department must match');
    }
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.creditNote.create({ data: { number: dto.number, total, currency: dto.currency ?? 'USD', notes: dto.notes, status: dto.status ?? 'draft', customerId: dto.customerId, relatedInvoiceId: dto.relatedInvoiceId, departmentId: dto.departmentId, ownerId: userId }, include: { department: true, customer: true, applications: true } });
      await this.audit.log({ action: 'CREDIT_NOTE_CREATED', entityType: 'CreditNote', entityId: note.id, departmentId: note.departmentId, actorId: userId, metadata: { number: note.number, total: total.toString(), customerId: note.customerId } }, tx);
      if (note.status !== 'draft') await this.accounting.postCreditNoteIssued(tx, { creditNoteId: note.id, number: note.number, amount: note.total, currency: note.currency, departmentId: note.departmentId, actorId: userId });
      return this.withBalance(note);
    });
  }

  async apply(userId: string, creditNoteId: string, dto: ApplyCreditNoteDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Application amount must be greater than zero');
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "CreditNote" WHERE id = ${creditNoteId} FOR UPDATE`);
      const note = await tx.creditNote.findUnique({ where: { id: creditNoteId }, include: { applications: true } });
      if (!note) throw new NotFoundException('Credit note not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, note.departmentId);
      if (!['issued', 'partially_applied'].includes(note.status)) throw new BadRequestException('Only issued credit notes can be applied');
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${dto.invoiceId} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({ where: { id: dto.invoiceId }, include: { payments: true, creditApplications: true } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);
      if (invoice.departmentId !== note.departmentId || invoice.customerId !== note.customerId) throw new BadRequestException('Credit note and invoice must belong to the same customer and department');
      if (invoice.currency !== note.currency) throw new BadRequestException('Credit note and invoice currencies must match');
      const applied = note.applications.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const paid = invoice.payments.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const invoiceCredits = invoice.creditApplications.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const availableCredit = note.total.minus(applied);
      const invoiceBalance = invoice.amount.minus(paid).minus(invoiceCredits);
      if (amount.gt(availableCredit)) throw new BadRequestException(`Application exceeds available credit (${availableCredit.toFixed(2)})`);
      if (amount.gt(invoiceBalance)) throw new BadRequestException(`Application exceeds invoice balance (${invoiceBalance.toFixed(2)})`);
      const application = await tx.creditNoteApplication.create({ data: { creditNoteId: note.id, invoiceId: invoice.id, amount, actorId: userId } });
      const nextCredit = availableCredit.minus(amount);
      const nextInvoiceBalance = invoiceBalance.minus(amount);
      await tx.creditNote.update({ where: { id: note.id }, data: { status: nextCredit.isZero() ? 'applied' : 'partially_applied' } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: nextInvoiceBalance.isZero() ? 'paid' : invoice.status } });
      await this.audit.log({ action: 'CREDIT_NOTE_APPLIED', entityType: 'CreditNoteApplication', entityId: application.id, departmentId: note.departmentId, actorId: userId, metadata: { creditNoteId: note.id, invoiceId: invoice.id, amount: amount.toString(), remainingCredit: nextCredit.toString(), remainingInvoiceBalance: nextInvoiceBalance.toString() } }, tx);
      return { application, creditNoteId: note.id, invoiceId: invoice.id, remainingCredit: nextCredit.toString(), remainingInvoiceBalance: nextInvoiceBalance.toString() };
    });
  }

  async reverse(userId: string, creditNoteId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "CreditNote" WHERE id = ${creditNoteId} FOR UPDATE`);
      const note = await tx.creditNote.findUnique({ where: { id: creditNoteId }, include: { applications: true } });
      if (!note) throw new NotFoundException('Credit note not found');
      ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, note.departmentId);
      if (note.status === 'void') throw new BadRequestException('Credit note is already void');
      if (note.status === 'draft') throw new BadRequestException('Draft credit notes do not have a journal to reverse');
      if (note.applications.length > 0) throw new BadRequestException('Applied credit notes cannot be reversed; reverse the applications first');
      const reversal = await this.accounting.reverseCreditNoteJournal(tx, { creditNoteId: note.id, number: note.number, departmentId: note.departmentId, actorId: userId });
      const updated = await tx.creditNote.update({ where: { id: note.id }, data: { status: 'void' } });
      await this.audit.log({ action: 'CREDIT_NOTE_VOIDED', entityType: 'CreditNote', entityId: note.id, departmentId: note.departmentId, actorId: userId, metadata: { reversalJournalEntryId: reversal.id } }, tx);
      return { creditNote: updated, reversalJournalEntryId: reversal.id };
    });
  }

  async customerBalance(userId: string, customerId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, departmentId: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);
    const [notes, invoices] = await Promise.all([
      this.prisma.creditNote.findMany({ where: { customerId, departmentId: customer.departmentId, status: { not: 'void' } }, include: { applications: true } }),
      this.prisma.invoice.findMany({ where: { customerId, departmentId: customer.departmentId }, include: { payments: true, creditApplications: true } }),
    ]);
    const appliedCredit = notes.reduce((sum, note) => sum.add(note.applications.reduce((inner, item) => inner.add(item.amount), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    const issuedCredit = notes.filter((note) => note.status !== 'draft').reduce((sum, note) => sum.add(note.total), new Prisma.Decimal(0));
    const openInvoiceBalance = invoices.reduce((sum, invoice) => sum.add(invoice.amount).minus(invoice.payments.reduce((inner, item) => inner.add(item.amount), new Prisma.Decimal(0))).minus(invoice.creditApplications.reduce((inner, item) => inner.add(item.amount), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    return { customer, currency: notes[0]?.currency ?? invoices[0]?.currency ?? 'USD', issuedCredit: issuedCredit.toString(), appliedCredit: appliedCredit.toString(), availableCredit: issuedCredit.minus(appliedCredit).toString(), openInvoiceBalance: openInvoiceBalance.toString(), creditNotes: notes.map((note) => this.withBalance(note)) };
  }

  private withBalance<T extends { total: Prisma.Decimal; applications: Array<{ amount: Prisma.Decimal }> }>(note: T) {
    const applied = note.applications.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    return { ...note, appliedTotal: applied.toString(), availableTotal: note.total.minus(applied).toString() };
  }
}
