import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Reconciliation and finance exceptions (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `recon-dept-${suffix}`;
  let userId: string;
  let token: string;
  let accountId: string;
  let journalEntryId: string;
  let sessionId: string;
  let transactionId: string;

  beforeAll(async () => {
    await prisma.department.create({ data: { id: departmentId, name: `Recon ${suffix}`, slug: `recon-${suffix}` } });
    const user = await prisma.user.create({ data: { email: `recon-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Recon', lastName: 'Owner' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `recon-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
    accountId = (await request(app.getHttpServer()).post('/accounting/accounts').set('Authorization', `Bearer ${token}`).send({ departmentId, code: '1000', name: 'Recon Cash', type: 'ASSET' }).expect(201)).body.id;
    const revenueId = (await request(app.getHttpServer()).post('/accounting/accounts').set('Authorization', `Bearer ${token}`).send({ departmentId, code: '4000', name: 'Recon Revenue', type: 'REVENUE' }).expect(201)).body.id;
    journalEntryId = (await request(app.getHttpServer()).post('/accounting/journal-entries').set('Authorization', `Bearer ${token}`).send({ departmentId, number: `RECON-JE-${suffix}`, date: new Date().toISOString(), lines: [{ accountId, debit: '40.00' }, { accountId: revenueId, credit: '40.00' }] }).expect(201)).body.id;
  });

  it('matches an exact bank transaction and closes a reconciled session', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const year = new Date().getUTCFullYear();
    const session = await request(app.getHttpServer()).post('/accounting/reconciliation/sessions').set(auth).send({ departmentId, accountId, name: `October ${suffix}`, statementStart: `${year}-01-01T00:00:00.000Z`, statementEnd: `${year + 1}-01-01T00:00:00.000Z`, openingBalance: '100.00' }).expect(201);
    sessionId = session.body.id;
    const imported = await request(app.getHttpServer()).post(`/accounting/reconciliation/sessions/${sessionId}/transactions`).set(auth).send({ transactions: [{ externalId: `BANK-${suffix}`, transactionDate: new Date().toISOString(), amount: '40.00', description: 'Customer receipt' }] }).expect(201);
    transactionId = imported.body.find((item: { externalId: string }) => item.externalId === `BANK-${suffix}`).id;
    await request(app.getHttpServer()).post(`/accounting/reconciliation/transactions/${transactionId}/match`).set(auth).send({ journalEntryId }).expect(201);
    await request(app.getHttpServer()).post(`/accounting/reconciliation/sessions/${sessionId}/close`).set(auth).send({ closingBalance: '140.00' }).expect(201);
  });

  it('creates, assigns, resolves, and scopes finance exceptions', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app.getHttpServer()).post('/accounting/exceptions').set(auth).send({ departmentId, type: 'MANUAL_REVIEW', severity: 'high', title: 'Review transfer', detail: 'Needs source document' }).expect(201);
    await request(app.getHttpServer()).post(`/accounting/exceptions/${created.body.id}/assign`).set(auth).send({ assigneeId: userId }).expect(201);
    const resolved = await request(app.getHttpServer()).post(`/accounting/exceptions/${created.body.id}/resolve`).set(auth).send({ resolutionNote: 'Source document attached' }).expect(201);
    expect(resolved.body.status).toBe('resolved');
    const open = await request(app.getHttpServer()).get(`/accounting/exceptions?departmentId=${departmentId}`).set(auth).expect(200);
    expect(open.body.some((item: { id: string }) => item.id === created.body.id)).toBe(false);
  });

  afterAll(async () => {
    await prisma.financeException.deleteMany({ where: { departmentId } });
    await prisma.reconciliationMatch.deleteMany({ where: { bankTransaction: { session: { departmentId } } } });
    await prisma.bankTransaction.deleteMany({ where: { session: { departmentId } } });
    await prisma.reconciliationSession.deleteMany({ where: { departmentId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { departmentId } } });
    await prisma.journalEntry.deleteMany({ where: { departmentId } });
    await prisma.account.deleteMany({ where: { departmentId } });
    await prisma.userDepartment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.department.delete({ where: { id: departmentId } });
    await app.close();
    await prisma.$disconnect();
  });
});
