#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';

// Install mysql2 in the API workspace before running this CLI.
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise') as { createConnection: (options: Record<string, unknown>) => Promise<MysqlConnection> };

type Row = Record<string, any>;
type MysqlConnection = { query: (sql: string) => Promise<[Row[]]>; end: () => Promise<void> };
const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const requiredTables = ['tblstaff', 'tblclients', 'tblcontacts', 'tblleads', 'tblprojects', 'tbltasks', 'tblinvoices', 'tblinvoicepaymentrecords', 'tbltickets', 'tblticketreplies'];
const table = (name: string) => `\`${name.replace(/[^a-zA-Z0-9_]/g, '')}\``;
const value = (row: Row, ...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && item !== '');
const id = (row: Row) => String(value(row, 'id', 'staffid', 'userid', 'clientid', 'leadid', 'projectid', 'taskid', 'invoiceid', 'ticketid') ?? '');

async function rows(connection: MysqlConnection, name: string) {
  const [result] = await connection.query(`SELECT * FROM ${table(name)}`);
  return result;
}

async function main() {
  const connection = await mysql.createConnection({ host: process.env.PERFEX_MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.PERFEX_MYSQL_PORT ?? 3306), user: process.env.PERFEX_MYSQL_USER, password: process.env.PERFEX_MYSQL_PASSWORD, database: process.env.PERFEX_MYSQL_DATABASE });
  try {
    const imported = Object.fromEntries(await Promise.all(requiredTables.map(async (name) => [name, await rows(connection, name)]))) as Record<string, Row[]>;
    console.table(requiredTables.map((name) => ({ table: name, rows: imported[name].length })));
    const invoiceRows = imported.tblinvoices;
    const paymentRows = imported.tblinvoicepaymentrecords;
    const invoiceById = new Map(invoiceRows.map((row) => [id(row), row]));
    const totalInvoiced = invoiceRows.reduce((sum, row) => sum + Number(value(row, 'total', 'total_tax', 'subtotal') ?? 0), 0);
    const totalPaid = paymentRows.reduce((sum, row) => sum + Number(value(row, 'amount') ?? 0), 0);
    console.log(`Perfex balance check: invoiced=${totalInvoiced.toFixed(2)} paid=${totalPaid.toFixed(2)} outstanding=${(totalInvoiced - totalPaid).toFixed(2)}`);
    if (dryRun) { console.log('Dry run complete: no PostgreSQL records were changed.'); return; }

    const defaultDepartmentId = await resolveDepartment();
    const staffMap = new Map<string, string>();
    const customerMap = new Map<string, string>();
    const projectMap = new Map<string, string>();
    const taskMap = new Map<string, string>();
    const invoiceMap = new Map<string, string>();
    const ticketMap = new Map<string, string>();
    await prisma.$transaction(async (tx) => {
      for (const row of imported.tblstaff) {
        const legacyId = id(row);
        const email = String(value(row, 'email') ?? `perfex-${legacyId}@invalid.local`).toLowerCase();
        const passwordHash = String(value(row, 'password') ?? '');
        const user = await tx.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: passwordHash.startsWith('$2') ? passwordHash : await bcrypt.hash(randomBytes(24).toString('hex'), 12), firstName: String(value(row, 'firstname', 'first_name') ?? 'Imported'), lastName: String(value(row, 'lastname', 'last_name') ?? 'Staff') } });
        await tx.userDepartment.upsert({ where: { userId_departmentId: { userId: user.id, departmentId: defaultDepartmentId } }, update: {}, create: { userId: user.id, departmentId: defaultDepartmentId, isPrimary: true } });
        staffMap.set(legacyId, user.id);
      }
      for (const row of imported.tblclients) {
        const legacyId = id(row);
        const customer = await tx.customer.create({ data: { name: String(value(row, 'company', 'name') ?? `Imported client ${legacyId}`), email: value(row, 'email') ? String(value(row, 'email')) : undefined, phone: value(row, 'phonenumber', 'phone') ? String(value(row, 'phonenumber', 'phone')) : undefined, departmentId: defaultDepartmentId } });
        customerMap.set(legacyId, customer.id);
      }
      for (const row of imported.tblcontacts) {
        const customerId = customerMap.get(String(value(row, 'userid', 'clientid') ?? ''));
        if (customerId) await tx.contact.create({ data: { customerId, name: `${value(row, 'firstname') ?? ''} ${value(row, 'lastname') ?? ''}`.trim() || 'Imported contact', email: value(row, 'email') ? String(value(row, 'email')) : undefined, phone: value(row, 'phonenumber', 'phone') ? String(value(row, 'phonenumber', 'phone')) : undefined, title: value(row, 'title') ? String(value(row, 'title')) : undefined } });
      }
      for (const row of imported.tblleads) {
        await tx.lead.create({ data: { title: String(value(row, 'name', 'description', 'company') ?? `Imported lead ${id(row)}`), source: value(row, 'source') ? String(value(row, 'source')) : undefined, value: value(row, 'lead_value', 'value') ? new Prisma.Decimal(String(value(row, 'lead_value', 'value'))) : undefined, email: value(row, 'email') ? String(value(row, 'email')) : undefined, departmentId: defaultDepartmentId } });
      }
      for (const row of imported.tblprojects) {
        const project = await tx.project.create({ data: { name: String(value(row, 'name') ?? `Imported project ${id(row)}`), description: value(row, 'description') ? String(value(row, 'description')) : undefined, status: String(value(row, 'status') ?? 'active'), departmentId: defaultDepartmentId, customerId: customerMap.get(String(value(row, 'clientid', 'userid') ?? '')) } });
        projectMap.set(id(row), project.id);
      }
      for (const row of imported.tbltasks) {
        const task = await tx.task.create({ data: { title: String(value(row, 'name', 'title') ?? `Imported task ${id(row)}`), description: value(row, 'description') ? String(value(row, 'description')) : undefined, status: String(value(row, 'status') ?? 'open'), departmentId: defaultDepartmentId, projectId: projectMap.get(String(value(row, 'rel_id', 'projectid') ?? '')) } });
        taskMap.set(id(row), task.id);
      }
      for (const row of invoiceRows) {
        const invoice = await tx.invoice.create({ data: { number: String(value(row, 'number') ?? `PERFEX-${id(row)}`), amount: new Prisma.Decimal(String(value(row, 'total', 'total_tax', 'subtotal') ?? 0)), currency: String(value(row, 'currency_name', 'currency') ?? 'USD'), status: 'draft', departmentId: defaultDepartmentId, customerId: customerMap.get(String(value(row, 'clientid', 'userid') ?? '')) } });
        invoiceMap.set(id(row), invoice.id);
      }
      for (const row of paymentRows) {
        const invoiceId = invoiceMap.get(String(value(row, 'invoiceid') ?? ''));
        if (invoiceId) await tx.payment.create({ data: { invoiceId, amount: new Prisma.Decimal(String(value(row, 'amount') ?? 0)), paymentDate: value(row, 'date') ? new Date(String(value(row, 'date'))) : undefined, method: value(row, 'paymentmode', 'method') ? String(value(row, 'paymentmode', 'method')) : undefined, transactionId: value(row, 'transactionid', 'transaction_id') ? String(value(row, 'transactionid', 'transaction_id')) : undefined } });
      }
      for (const row of imported.tbltickets) {
        const ticket = await tx.ticket.create({ data: { subject: String(value(row, 'subject') ?? `Imported ticket ${id(row)}`), message: value(row, 'message') ? String(value(row, 'message')) : undefined, status: String(value(row, 'status') ?? 'open'), priority: String(value(row, 'priority') ?? 'normal'), departmentId: defaultDepartmentId, customerId: customerMap.get(String(value(row, 'userid', 'clientid') ?? '')), requesterId: staffMap.get(String(value(row, 'admin', 'staffid') ?? '')) } });
        ticketMap.set(id(row), ticket.id);
      }
      for (const row of imported.tblticketreplies) {
        const ticketId = ticketMap.get(String(value(row, 'ticketid') ?? ''));
        if (ticketId) await tx.ticketReply.create({ data: { ticketId, body: String(value(row, 'message') ?? ''), internal: Boolean(Number(value(row, 'staffid', 'admin') ?? 0)) } });
      }
    });
    console.log(`Migration committed: ${staffMap.size} staff, ${customerMap.size} customers, ${projectMap.size} projects, ${taskMap.size} tasks, ${invoiceMap.size} invoices, ${ticketMap.size} tickets.`);
    console.log(`Legacy passwords were preserved only for compatible bcrypt hashes; all other imported users receive a random reset-required password.`);
    void invoiceById;
  } finally { await connection.end(); await prisma.$disconnect(); }
}

async function resolveDepartment() {
  const configured = process.env.PERFEX_DEFAULT_DEPARTMENT_ID;
  if (configured) return configured;
  const department = await prisma.department.upsert({ where: { slug: 'perfex-migration' }, update: {}, create: { name: 'Perfex Migration', slug: 'perfex-migration' } });
  return department.id;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
