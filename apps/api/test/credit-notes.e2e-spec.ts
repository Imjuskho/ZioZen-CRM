import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Credit notes (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `credits-dept-${suffix}`;
  const otherDepartmentId = `credits-other-${suffix}`;
  let userId: string;
  let customerId: string;
  let invoiceId: string;
  let creditNoteId: string;
  let token: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `Credits ${suffix}`, slug: `credits-${suffix}` }, { id: otherDepartmentId, name: `Credits Other ${suffix}`, slug: `credits-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `credits-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Credit', lastName: 'Owner' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const customer = await prisma.customer.create({ data: { name: `Credit Customer ${suffix}`, departmentId } });
    customerId = customer.id;
    const invoice = await prisma.invoice.create({ data: { number: `CREDIT-INV-${suffix}`, amount: '100.00', currency: 'USD', status: 'issued', departmentId, customerId } });
    invoiceId = invoice.id;
    const note = await prisma.creditNote.create({ data: { number: `CREDIT-NOTE-${suffix}`, total: '75.00', currency: 'USD', status: 'issued', departmentId, customerId } });
    creditNoteId = note.id;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `credits-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('applies exact Decimal credit and exposes the remaining balance', async () => {
    const applied = await request(app.getHttpServer()).post(`/credit-notes/${creditNoteId}/apply`).set('Authorization', `Bearer ${token}`).send({ invoiceId, amount: '25.10' }).expect(201);
    expect(applied.body.remainingCredit).toBe('49.90');
    expect(applied.body.remainingInvoiceBalance).toBe('74.90');
    const balance = await request(app.getHttpServer()).get(`/credit-notes/customers/${customerId}/balance`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(balance.body.availableCredit).toBe('49.90');
    expect(balance.body.openInvoiceBalance).toBe('74.90');
  });

  it('rejects over-application and cross-department application', async () => {
    await request(app.getHttpServer()).post(`/credit-notes/${creditNoteId}/apply`).set('Authorization', `Bearer ${token}`).send({ invoiceId, amount: '50.00' }).expect(400);
    const otherCustomer = await prisma.customer.create({ data: { name: `Other Credit Customer ${suffix}`, departmentId: otherDepartmentId } });
    const otherInvoice = await prisma.invoice.create({ data: { number: `OTHER-CREDIT-INV-${suffix}`, amount: '50.00', departmentId: otherDepartmentId, customerId: otherCustomer.id } });
    await request(app.getHttpServer()).post(`/credit-notes/${creditNoteId}/apply`).set('Authorization', `Bearer ${token}`).send({ invoiceId: otherInvoice.id, amount: '1.00' }).expect(403);
  });

  it('auto-journals an issued credit note and reverses it exactly once', async () => {
    const issued = await request(app.getHttpServer()).post('/credit-notes').set('Authorization', `Bearer ${token}`).send({ number: `CREDIT-ISSUED-${suffix}`, total: '10.00', currency: 'USD', departmentId, customerId, status: 'issued' }).expect(201);
    const original = await prisma.journalEntry.findUnique({ where: { number: `JE-CN-${issued.body.id}` } });
    expect(original).not.toBeNull();
    const reversal = await request(app.getHttpServer()).post(`/credit-notes/${issued.body.id}/reverse`).set('Authorization', `Bearer ${token}`).expect(201);
    expect(reversal.body.reversalJournalEntryId).toBeTruthy();
    await request(app.getHttpServer()).post(`/credit-notes/${issued.body.id}/reverse`).set('Authorization', `Bearer ${token}`).expect(400);
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({ where: { journalEntry: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.journalEntry.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.creditNoteApplication.deleteMany({ where: { creditNote: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.creditNote.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.invoice.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.customer.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
    await app.close();
    await prisma.$disconnect();
  });
});
