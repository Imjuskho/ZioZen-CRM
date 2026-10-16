import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Accounting ledger (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `ledger-dept-${suffix}`;
  const otherDepartmentId = `ledger-other-${suffix}`;
  let userId: string;
  let token: string;
  let cashId: string;
  let revenueId: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `Ledger ${suffix}`, slug: `ledger-${suffix}` }, { id: otherDepartmentId, name: `Ledger Other ${suffix}`, slug: `ledger-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `ledger-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Ledger', lastName: 'Owner' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `ledger-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
    cashId = (await request(app.getHttpServer()).post('/accounting/accounts').set('Authorization', `Bearer ${token}`).send({ departmentId, code: '1000', name: 'Cash', type: 'ASSET' }).expect(201)).body.id;
    revenueId = (await request(app.getHttpServer()).post('/accounting/accounts').set('Authorization', `Bearer ${token}`).send({ departmentId, code: '4000', name: 'Service Revenue', type: 'REVENUE' }).expect(201)).body.id;
  });

  it('rejects unbalanced entries and posts exact Decimal balanced entries', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/accounting/journal-entries').set(auth).send({ departmentId, number: `UNBALANCED-${suffix}`, lines: [{ accountId: cashId, debit: '10.01' }, { accountId: revenueId, credit: '10.00' }] }).expect(400);
    const posted = await request(app.getHttpServer()).post('/accounting/journal-entries').set(auth).send({ departmentId, number: `JE-${suffix}`, memo: 'Service sale', lines: [{ accountId: cashId, debit: '125.10' }, { accountId: revenueId, credit: '125.10' }] }).expect(201);
    expect(posted.body.totalDebit).toBe('125.1');
    expect(posted.body.totalCredit).toBe('125.1');
    const trial = await request(app.getHttpServer()).get(`/accounting/trial-balance?departmentId=${departmentId}`).set(auth).expect(200);
    expect(trial.body.totalDebit).toBe('125.1');
    expect(trial.body.totalCredit).toBe('125.1');
    expect(trial.body.balanced).toBe(true);
    const invoice = await request(app.getHttpServer()).post('/invoices').set(auth).send({ number: `AUTO-INV-${suffix}`, amount: '50.00', currency: 'USD', departmentId, status: 'issued' }).expect(201);
    await request(app.getHttpServer()).post(`/invoices/${invoice.body.id}/payments`).set(auth).send({ amount: '20.00', method: 'bank_transfer', transactionId: `AUTO-PAY-${suffix}` }).expect(201);
    const entries = await request(app.getHttpServer()).get(`/accounting/journal-entries?departmentId=${departmentId}`).set(auth).expect(200);
    expect(entries.body.some((entry: { number: string }) => entry.number === `JE-INV-${invoice.body.id}`)).toBe(true);
    expect(entries.body.some((entry: { number: string }) => entry.number.startsWith('JE-PAY-'))).toBe(true);
    const profitLoss = await request(app.getHttpServer()).get(`/accounting/profit-loss?departmentId=${departmentId}`).set(auth).expect(200);
    expect(profitLoss.body.revenue).toBe('175.1');
    expect(profitLoss.body.expenses).toBe('0');
    expect(profitLoss.body.netProfit).toBe('175.1');
    const year = new Date().getUTCFullYear();
    const period = await request(app.getHttpServer()).post('/accounting/periods').set(auth).send({ departmentId, name: `FY-${year}`, startDate: `${year}-01-01T00:00:00.000Z`, endDate: `${year + 1}-01-01T00:00:00.000Z` }).expect(201);
    const readiness = await request(app.getHttpServer()).get(`/accounting/periods/${period.body.id}/close-readiness`).set(auth).expect(200);
    expect(readiness.body.ready).toBe(true);
    await request(app.getHttpServer()).post(`/accounting/periods/${period.body.id}/sign-off`).set(auth).send({ note: 'Reviewed ledger and exceptions' }).expect(201);
    await request(app.getHttpServer()).post(`/accounting/periods/${period.body.id}/close`).set(auth).expect(201);
    await request(app.getHttpServer()).post('/accounting/journal-entries').set(auth).send({ departmentId, number: `CLOSED-${suffix}`, lines: [{ accountId: cashId, debit: '1.00' }, { accountId: revenueId, credit: '1.00' }] }).expect(409);
  });

  it('does not allow posting across departments', async () => {
    await request(app.getHttpServer()).post('/accounting/journal-entries').set('Authorization', `Bearer ${token}`).send({ departmentId: otherDepartmentId, number: `CROSS-${suffix}`, lines: [{ accountId: cashId, debit: '1.00' }, { accountId: revenueId, credit: '1.00' }] }).expect(403);
    await request(app.getHttpServer()).get(`/accounting/accounts?departmentId=${otherDepartmentId}`).set('Authorization', `Bearer ${token}`).expect(403);
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoice: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.invoice.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.journalEntry.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.account.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.periodSignOff.deleteMany({ where: { accountingPeriod: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.accountingPeriod.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
    await app.close();
    await prisma.$disconnect();
  });
});
