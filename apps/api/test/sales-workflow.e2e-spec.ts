import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Sales Pipeline and Conversion Workflows (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const dept1Id = `dept-sales1-${suffix}`;
  const dept2Id = `dept-sales2-${suffix}`;
  const user1Email = `sales1-${suffix}@crm.local`;
  const user2Email = `sales2-${suffix}@crm.local`;
  const password = 'StrongPassword123!';

  let token1: string;
  let token2: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Create two isolated departments
    await prisma.department.createMany({
      data: [
        { id: dept1Id, name: `Sales Dept 1 ${suffix}`, slug: `sales1-${suffix}` },
        { id: dept2Id, name: `Sales Dept 2 ${suffix}`, slug: `sales2-${suffix}` },
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
      .send({ email: user1Email, password, firstName: 'Sales', lastName: 'Rep1' })
      .expect(201);
    token1 = resReg1.body.accessToken;

    const resReg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password, firstName: 'Sales', lastName: 'Rep2' })
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
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { departmentId: { in: [dept1Id, dept2Id] } } },
    });
    await prisma.invoice.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.estimateItem.deleteMany({
      where: { estimate: { departmentId: { in: [dept1Id, dept2Id] } } },
    });
    await prisma.estimate.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.lead.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.project.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.customer.deleteMany({
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

  it('handles Lead creation, updates, and transaction-safe conversion to Customer and Project', async () => {
    // 1. Create a lead
    const createLeadRes = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Global Tech Inbound Inquiry',
        source: 'Website Contact Form',
        value: '15000',
        email: 'inbound@globaltech.example',
        phone: '+1-555-0199',
        notes: 'Interested in enterprise license and onboarding',
        departmentId: dept1Id,
      })
      .expect(201);

    expect(createLeadRes.body.id).toBeDefined();
    expect(createLeadRes.body.status).toBe('new');
    const leadId = createLeadRes.body.id;

    // 2. Update lead status
    await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ status: 'qualified' })
      .expect(200);

    // 3. Negative authorization: User 2 cannot access or convert lead in Dept 1
    await request(app.getHttpServer())
      .post(`/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ companyName: 'Hacked Corp' })
      .expect(403);

    // 4. Convert lead into Customer and Project transaction-safely
    const convertRes = await request(app.getHttpServer())
      .post(`/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        companyName: 'Global Tech Enterprises',
        projectName: 'Global Tech CRM Onboarding',
      })
      .expect(201);

    expect(convertRes.body.lead.status).toBe('converted');
    expect(convertRes.body.customer.name).toBe('Global Tech Enterprises');
    expect(convertRes.body.customer.email).toBe('inbound@globaltech.example');
    expect(convertRes.body.project.name).toBe('Global Tech CRM Onboarding');
    expect(convertRes.body.project.customerId).toBe(convertRes.body.customer.id);

    // 5. Duplicate conversion prevention
    await request(app.getHttpServer())
      .post(`/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ companyName: 'Duplicate Corp' })
      .expect(400);

    // 6. Verify audit log recorded conversion
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Lead', entityId: leadId },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('LEAD_CREATED');
    expect(actions).toContain('LEAD_UPDATED');
    expect(actions).toContain('LEAD_CONVERTED');
  });

  it('handles Estimate creation with line item calculations and conversion to Invoice', async () => {
    // 1. Create estimate with multi-item calculations
    const createEstimateRes = await request(app.getHttpServer())
      .post('/estimates')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        number: `EST-${suffix}`,
        departmentId: dept1Id,
        currency: 'USD',
        notes: 'Quote for Q4 consulting and setup',
        items: [
          { description: 'Consulting Hours', quantity: 20, rate: 150, taxPercent: 10, discount: 0 },
          { description: 'Setup Fee', quantity: 1, rate: 500, taxPercent: 0, discount: 50 },
        ],
      })
      .expect(201);

    expect(createEstimateRes.body.id).toBeDefined();
    // Item 1: 20 * 150 = 3000 + 10% tax (300) = 3300
    // Item 2: 1 * 500 - 50 discount = 450
    // Total = 3750.00
    expect(Number(createEstimateRes.body.total)).toBe(3750);
    const estimateId = createEstimateRes.body.id;

    // 2. Negative authorization: User 2 cannot convert Dept 1 estimate
    await request(app.getHttpServer())
      .post(`/estimates/${estimateId}/convert`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    // 3. User 1 converts estimate into invoice
    const convertEstimateRes = await request(app.getHttpServer())
      .post(`/estimates/${estimateId}/convert`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(201);

    expect(convertEstimateRes.body.estimate.status).toBe('converted');
    expect(convertEstimateRes.body.invoice.number).toBe(`INV-EST-${suffix}`);
    expect(Number(convertEstimateRes.body.invoice.amount)).toBe(3750);
    expect(convertEstimateRes.body.invoice.items).toHaveLength(2);

    // 4. Duplicate conversion prevention
    await request(app.getHttpServer())
      .post(`/estimates/${estimateId}/convert`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    // 5. Verify audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Estimate', entityId: estimateId },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('ESTIMATE_CREATED');
    expect(actions).toContain('ESTIMATE_CONVERTED');
  });
});
