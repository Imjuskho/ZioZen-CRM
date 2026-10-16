import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CustomerLoginDto, CustomerPortalProvisionDto, CustomerPortalReplyDto, CustomerPortalResetPasswordDto, CustomerPortalStateDto, CustomerPortalTicketDto } from './dto/customer-portal.dto.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class CustomerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: CustomerLoginDto) {
    const account = await this.prisma.customerPortalAccount.findUnique({ where: { email: dto.email.toLowerCase() }, include: { customer: true } });
    if (!account?.active || !(await bcrypt.compare(dto.password, account.passwordHash))) {
      throw new UnauthorizedException('Invalid customer portal credentials');
    }
    await this.prisma.customerPortalAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    return {
      accessToken: this.jwt.sign({ sub: account.customerId, email: account.email, portal: true }, { secret: this.config.getOrThrow<string>('JWT_SECRET') }),
      tokenType: 'Bearer',
      customer: { id: account.customer.id, name: account.customer.name, email: account.customer.email },
    };
  }

  async projects(customerId: string) {
    const customer = await this.assertCustomer(customerId);
    return this.prisma.project.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, name: true, description: true, status: true, createdAt: true, updatedAt: true, tasks: { where: { departmentId: customer.departmentId }, select: { id: true, title: true, status: true, priority: true, dueAt: true }, orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
  }

  async invoices(customerId: string) {
    const customer = await this.assertCustomer(customerId);
    return this.prisma.invoice.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, number: true, amount: true, currency: true, status: true, notes: true, createdAt: true, payments: { select: { amount: true, paymentDate: true, method: true } }, items: { select: { description: true, quantity: true, rate: true, amount: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async invoiceHtml(customerId: string, invoiceId: string) {
    const customer = await this.assertCustomer(customerId);
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, customerId, departmentId: customer.departmentId }, include: { items: true, payments: true, department: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
    await this.audit.log({ action: 'CUSTOMER_PORTAL_INVOICE_DOCUMENT_VIEWED', entityType: 'Invoice', entityId: invoice.id, departmentId: invoice.departmentId, metadata: { customerId, invoiceNumber: invoice.number } });
    return { html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invoice.number)}</title><style>@page{size:A4;margin:18mm}body{font:16px system-ui;max-width:800px;margin:40px auto;color:#172033}header{display:flex;justify-content:space-between;border-bottom:3px solid #d8ff5b;padding-bottom:18px;margin-bottom:24px}header h1{margin:0}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{font-size:12px;text-transform:uppercase;color:#68776c}.total{text-align:right;font-weight:700}.note{padding:12px;background:#f4f7f2;border-radius:6px}</style></head><body><header><div><h1>${esc(invoice.department.name)}</h1><p>Customer document</p></div><div><strong>Invoice ${esc(invoice.number)}</strong><br>${esc(invoice.createdAt.toLocaleDateString())}</div></header><p>Status: ${esc(invoice.status)}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${esc(item.description)}</td><td>${esc(item.quantity)}</td><td>${esc(item.rate)}</td><td>${esc(item.amount)}</td></tr>`).join('')}</tbody></table>${invoice.notes ? `<p class="note">${esc(invoice.notes)}</p>` : ''}<p class="total">Total: ${esc(invoice.amount)} ${esc(invoice.currency)}<br>Paid: ${paid.toFixed(2)}<br>Balance Due: ${(Number(invoice.amount) - paid).toFixed(2)}</p></body></html>` };
  }

  async tickets(customerId: string) {
    await this.assertCustomer(customerId);
    const customer = await this.assertCustomer(customerId);
    return this.prisma.ticket.findMany({ where: { customerId, departmentId: customer.departmentId }, select: { id: true, subject: true, message: true, status: true, priority: true, createdAt: true, updatedAt: true, replies: { where: { internal: false }, select: { id: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  }

  async createTicket(customerId: string, dto: CustomerPortalTicketDto) {
    const customer = await this.assertCustomer(customerId);
    const ticket = await this.prisma.ticket.create({ data: { subject: dto.subject, message: dto.message, priority: dto.priority ?? 'normal', customerId, departmentId: customer.departmentId, status: 'open' }, select: { id: true, subject: true, message: true, status: true, priority: true, createdAt: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_TICKET_CREATED', entityType: 'Ticket', entityId: ticket.id, departmentId: customer.departmentId, metadata: { customerId }, });
    return ticket;
  }

  async reply(customerId: string, ticketId: string, dto: CustomerPortalReplyDto) {
    const customer = await this.assertCustomer(customerId);
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, customerId, departmentId: customer.departmentId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const reply = await this.prisma.ticketReply.create({ data: { ticketId, body: dto.body, internal: false }, select: { id: true, body: true, internal: true, createdAt: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_TICKET_REPLY_ADDED', entityType: 'TicketReply', entityId: reply.id, departmentId: ticket.departmentId, metadata: { customerId, ticketId }, });
    return reply;
  }


  async accountStatus(actorUserId: string, customerId: string) {
    await this.assertCustomerScope(actorUserId, customerId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, departmentId: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    const account = await this.prisma.customerPortalAccount.findUnique({ where: { customerId }, select: { id: true, email: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true } });
    return { customer, account };
  }

  async provisionAccount(actorUserId: string, customerId: string, dto: CustomerPortalProvisionDto) {
    const customer = await this.assertCustomerScope(actorUserId, customerId);
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.prisma.customerPortalAccount.findFirst({ where: { OR: [{ customerId }, { email: normalizedEmail }] } });
    if (existing && existing.customerId !== customerId) throw new ForbiddenException('Portal account email is already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const account = existing
      ? await this.prisma.customerPortalAccount.update({ where: { customerId }, data: { email: normalizedEmail, passwordHash, active: dto.active ?? true }, select: { id: true, email: true, active: true, createdAt: true, updatedAt: true } })
      : await this.prisma.customerPortalAccount.create({ data: { customerId, email: normalizedEmail, passwordHash, active: dto.active ?? true }, select: { id: true, email: true, active: true, createdAt: true, updatedAt: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_ACCOUNT_PROVISIONED', entityType: 'CustomerPortalAccount', entityId: account.id, departmentId: customer.departmentId, actorId: actorUserId, metadata: { customerId, email: account.email } });
    return account;
  }

  async setAccountState(actorUserId: string, customerId: string, dto: CustomerPortalStateDto) {
    const customer = await this.assertCustomerScope(actorUserId, customerId);
    const account = await this.prisma.customerPortalAccount.update({ where: { customerId }, data: { active: dto.active ?? true }, select: { id: true, email: true, active: true, updatedAt: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_ACCOUNT_STATE_CHANGED', entityType: 'CustomerPortalAccount', entityId: account.id, departmentId: customer.departmentId, actorId: actorUserId, metadata: { customerId, active: account.active } });
    return account;
  }

  async resetAccountPassword(actorUserId: string, customerId: string, dto: CustomerPortalResetPasswordDto) {
    const customer = await this.assertCustomerScope(actorUserId, customerId);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const account = await this.prisma.customerPortalAccount.update({ where: { customerId }, data: { passwordHash }, select: { id: true, email: true, active: true, updatedAt: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_PASSWORD_RESET', entityType: 'CustomerPortalAccount', entityId: account.id, departmentId: customer.departmentId, actorId: actorUserId, metadata: { customerId } });
    return account;
  }

  async deleteAccount(actorUserId: string, customerId: string) {
    const customer = await this.assertCustomerScope(actorUserId, customerId);
    const account = await this.prisma.customerPortalAccount.delete({ where: { customerId }, select: { id: true, email: true } });
    await this.audit.log({ action: 'CUSTOMER_PORTAL_ACCOUNT_DELETED', entityType: 'CustomerPortalAccount', entityId: account.id, departmentId: customer.departmentId, actorId: actorUserId, metadata: { customerId, email: account.email } });
    return { deleted: true };
  }

  private async assertCustomerScope(actorUserId: string, customerId: string) {
    const scope = await getUserScope(this.prisma, actorUserId);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, departmentId: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, customer.departmentId);
    return customer;
  }

  private async assertCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, departmentId: true } });
    if (!customer) throw new ForbiddenException('Customer portal account is not active');
    return customer;
  }
}
