import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvoicesService } from './invoices.service.js';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async generateHtml(userId: string, invoiceId: string): Promise<string> {
    const invoice = await this.invoicesService.findOne(userId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const branding: any = (invoice.department as any)?.branding ?? {};
    const primaryColor = branding.primaryColor || '#1e293b';
    const logoUrl = branding.logoUrl || '';
    const headerText = branding.headerText || invoice.department?.name || 'ZioZen CRM';
    const footerText = branding.footerText || 'Thank you for your business.';
    const signature = branding.emailSignature || '';

    const itemsHtml = invoice.items && invoice.items.length > 0
      ? invoice.items.map((it: any) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">${it.description}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.quantity}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(it.rate).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${(Number(it.rate) * Number(it.quantity)).toFixed(2)}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">Standard Professional Services</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">1</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(invoice.amount).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(invoice.amount).toFixed(2)}</td>
          </tr>
        `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${primaryColor}; padding-bottom: 24px; margin-bottom: 30px; }
    .dept-title { font-size: 24px; font-weight: 800; color: ${primaryColor}; margin: 0 0 6px 0; }
    .inv-title { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0; text-align: right; }
    .inv-meta { text-align: right; font-size: 13px; color: #64748b; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; }
    .box h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .totals { width: 300px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; background: #f8fafc; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
    .totals-row.strong { font-weight: 700; font-size: 16px; color: ${primaryColor}; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 8px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: 48px; margin-bottom: 8px;" /><br/>` : ''}
      <h1 class="dept-title">${headerText}</h1>
      <div style="font-size: 13px; color: #64748b;">Department: ${invoice.department?.name}</div>
    </div>
    <div>
      <h2 class="inv-title">INVOICE</h2>
      <div class="inv-meta">
        <strong>${invoice.number}</strong><br/>
        Date: ${new Date(invoice.createdAt).toLocaleDateString()}<br/>
        Status: <span style="text-transform: uppercase; font-weight: 600;">${invoice.status}</span>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h4>Billed From</h4>
      <strong>${invoice.department?.name}</strong><br/>
      ${signature ? `<div style="margin-top: 4px; font-size: 13px;">${signature}</div>` : ''}
    </div>
    <div class="box">
      <h4>Billed To</h4>
      <strong>${invoice.customer?.name || 'Valued Customer'}</strong><br/>
      ${invoice.customer?.company ? `${invoice.customer.company}<br/>` : ''}
      ${invoice.customer?.email ? `${invoice.customer.email}<br/>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Rate</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>$${Number(invoice.amount).toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Paid Total:</span>
      <span style="color: #16a34a;">-$${Number(invoice.paidTotal).toFixed(2)}</span>
    </div>
    <div class="totals-row strong">
      <span>Balance Due:</span>
      <span>$${Number(invoice.outstandingBalance).toFixed(2)} ${invoice.currency}</span>
    </div>
  </div>

  <div class="footer">
    ${footerText}
  </div>
</body>
</html>`;
  }
}
