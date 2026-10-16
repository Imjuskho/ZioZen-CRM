import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUserScope, ensureDepartmentAccess } from '../common/department-scope.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async renderInvoice(userId: string, invoiceId: string): Promise<string> {
    const scope = await getUserScope(this.prisma, userId);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { department: true, customer: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, invoice.departmentId);

    const branding = (invoice.department.branding as Record<string, string> | null) || {};
    const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
    const color = esc(branding.primaryColor || '#1d4ed8').replace(/[^#a-zA-Z0-9(),.% -]/g, '');
    const logo = esc(branding.logoUrl || '');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoice.number}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
      .brand { color: ${color}; border-bottom: 3px solid ${color}; padding-bottom: 16px; }
      .row { display: flex; justify-content: space-between; margin: 24px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
      th { background: #f8fafc; }
    </style>
  </head>
  <body>
    <div class="brand">
      ${logo ? `<img src="${logo}" alt="logo" height="48" />` : ''}
      <h1>${esc(invoice.department.name)}</h1>
    </div>
    <h2>Invoice ${esc(invoice.number)}</h2>
    <div class="row">
      <div>
        <strong>Customer:</strong> ${esc(invoice.customer?.name ?? 'n/a')}<br />
        <strong>Status:</strong> ${esc(invoice.status)}<br />
        <strong>Currency:</strong> ${esc(invoice.currency)}
      </div>
      <div>
        <strong>Total:</strong> ${esc(invoice.amount.toString())} ${esc(invoice.currency)}
      </div>
    </div>
    ${invoice.notes ? `<p>${esc(invoice.notes)}</p>` : ''}
  </body>
</html>`;
  }
}
