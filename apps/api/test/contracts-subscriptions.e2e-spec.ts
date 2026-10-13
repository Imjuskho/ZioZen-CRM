import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Contracts & Subscriptions Lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const dept1Id = `dept-adv1-${suffix}`;
  const dept2Id = `dept-adv2-${suffix}`;
  const user1Email = `adv1-${suffix}@crm.local`;
  const user2Email = `adv2-${suffix}@crm.local`;
  const password = 'StrongPassword123!';

  let token1: string;
  let token2: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Create departments
    await prisma.department.createMany({
      data: [
        { id: dept1Id, name: `Ops Dept 1 ${suffix}`, slug: `ops1-${suffix}` },
        { id: dept2Id, name: `Ops Dept 2 ${suffix}`, slug: `ops2-${suffix}` },
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
      .send({ email: user1Email, password, firstName: 'Ops', lastName: 'One' })
      .expect(201);
    token1 = resReg1.body.accessToken;

    const resReg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password, firstName: 'Ops', lastName: 'Two' })
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
    await prisma.subscription.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.contract.deleteMany({
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

  it('manages Contract terms, status lifecycle, and department isolation', async () => {
    // 1. Create a contract in Dept 1
    const createRes = await request(app.getHttpServer())
      .post('/contracts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        subject: 'Master Services Agreement 2026',
        value: '50000.00',
        departmentId: dept1Id,
        content: 'Standard MSA terms and SLAs.',
      })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.status).toBe('draft');
    const contractId = createRes.body.id;

    // 2. Negative authorization: User 2 cannot access or update Dept 1 contract
    await request(app.getHttpServer())
      .get(`/contracts/${contractId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/contracts/${contractId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ status: 'active' })
      .expect(403);

    // 3. User 1 activates contract
    const updateRes = await request(app.getHttpServer())
      .patch(`/contracts/${contractId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ status: 'active' })
      .expect(200);

    expect(updateRes.body.status).toBe('active');

    // 4. Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Contract', entityId: contractId },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('CONTRACT_CREATED');
    expect(actions).toContain('CONTRACT_UPDATED');
  });

  it('manages Subscription recurring billing schedules and department isolation', async () => {
    // 1. Create recurring subscription
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
    const createSubRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'Enterprise Cloud Retainer',
        amount: '2499.00',
        interval: 'monthly',
        nextBillingDate: nextMonth,
        departmentId: dept1Id,
      })
      .expect(201);

    expect(createSubRes.body.id).toBeDefined();
    expect(createSubRes.body.status).toBe('active');
    const subId = createSubRes.body.id;

    // 2. Negative authorization: User 2 cannot access Dept 1 subscription
    await request(app.getHttpServer())
      .get(`/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    // 3. User 1 cancels subscription
    const cancelRes = await request(app.getHttpServer())
      .patch(`/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ status: 'cancelled' })
      .expect(200);

    expect(cancelRes.body.status).toBe('cancelled');

    // 4. Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Subscription', entityId: subId },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('SUBSCRIPTION_CREATED');
    expect(actions).toContain('SUBSCRIPTION_UPDATED');
  });
});
