import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Financial Operations & Reconciliation (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const dept1Id = `dept-fin1-${suffix}`;
  const dept2Id = `dept-fin2-${suffix}`;
  const user1Email = `fin1-${suffix}@crm.local`;
  const user2Email = `fin2-${suffix}@crm.local`;
  const password = 'StrongPassword123!';

  let token1: string;
  let token2: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Create departments
    await prisma.department.createMany({
      data: [
        { id: dept1Id, name: `Finance Dept 1 ${suffix}`, slug: `fin1-${suffix}` },
        { id: dept2Id, name: `Finance Dept 2 ${suffix}`, slug: `fin2-${suffix}` },
      ],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 2. Register users
    const resReg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user1Email, password, firstName: 'Finance', lastName: 'User1' })
      .expect(201);
    token1 = resReg1.body.accessToken;

    const resReg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password, firstName: 'Finance', lastName: 'User2' })
      .expect(201);
    token2 = resReg2.body.accessToken;

    const dbUser1 = await prisma.user.findUniqueOrThrow({ where: { email: user1Email } });
    const dbUser2 = await prisma.user.findUniqueOrThrow({ where: { email: user2Email } });
    user1Id = dbUser1.id;
    user2Id = dbUser2.id;

    // 3. Department memberships
    await prisma.userDepartment.createMany({
      data: [
        { userId: user1Id, departmentId: dept1Id, isPrimary: true },
        { userId: user2Id, departmentId: dept2Id, isPrimary: true },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.payment.deleteMany({
      where: { invoice: { departmentId: { in: [dept1Id, dept2Id] } } },
    });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { departmentId: { in: [dept1Id, dept2Id] } } },
    });
    await prisma.invoice.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.userDepartment.deleteMany({
      where: { userId: { in: [user1Id, user2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1Id, user2Id] } },
    });
    await prisma.department.deleteMany({
      where: { id: { in: [dept1Id, dept2Id] } },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it('manages partial payments, reconciles balances, enforces idempotency and overpayment bounds', async () => {
    // 1. Create an invoice of $1000.00 in Dept 1
    const invoiceRes = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        number: `INV-FIN-${suffix}`,
        amount: '1000.00',
        departmentId: dept1Id,
        currency: 'USD',
      })
      .expect(201);

    const invoiceId = invoiceRes.body.id;
    expect(invoiceRes.body.status).toBe('draft');

    // 2. Negative auth: User 2 cannot post payment to Dept 1 invoice
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token2}`)
      .send({
        amount: '200.00',
        method: 'credit_card',
      })
      .expect(403);

    // 3. User 1 posts partial payment #1: $400.00
    const payment1Res = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        amount: '400.00',
        method: 'bank_transfer',
        transactionId: `tx-1-${suffix}`,
        notes: 'Deposit 40%',
      })
      .expect(201);

    expect(payment1Res.body.invoiceStatus).toBe('partially_paid');
    expect(Number(payment1Res.body.totalPaid)).toBe(400);
    expect(Number(payment1Res.body.outstandingBalance)).toBe(600);

    // 4. Idempotency test: duplicate transactionId must be rejected with 409 Conflict
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        amount: '400.00',
        method: 'bank_transfer',
        transactionId: `tx-1-${suffix}`,
      })
      .expect(409);

    // 5. Overpayment guard: attempt to pay $700 (which exceeds remaining $600) -> 400 Bad Request
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        amount: '700.00',
        method: 'credit_card',
      })
      .expect(400);

    // 6. User 1 posts final settlement payment: $600.00
    const payment2Res = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        amount: '600.00',
        method: 'credit_card',
        transactionId: `tx-2-${suffix}`,
        notes: 'Final settlement',
      })
      .expect(201);

    expect(payment2Res.body.invoiceStatus).toBe('paid');
    expect(Number(payment2Res.body.totalPaid)).toBe(1000);
    expect(Number(payment2Res.body.outstandingBalance)).toBe(0);

    // 7. Reconcile invoice detail endpoint
    const invoiceDetailRes = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(invoiceDetailRes.body.status).toBe('paid');
    expect(Number(invoiceDetailRes.body.paidTotal)).toBe(1000);
    expect(Number(invoiceDetailRes.body.outstandingBalance)).toBe(0);
    expect(invoiceDetailRes.body.payments).toHaveLength(2);

    // 8. Verify audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Payment', departmentId: dept1Id },
    });
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[0].action).toBe('PAYMENT_RECORDED');
  });
});
