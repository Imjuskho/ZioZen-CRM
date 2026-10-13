import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Reporting, Analytics & Data Migration Toolkit (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const userEmail = `admin-rep-${suffix}@crm.local`;
  const password = 'StrongPassword123!';
  let token: string;
  let userId: string;
  let departmentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Register admin user
    const resReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password, firstName: 'Reporting', lastName: 'Admin' })
      .expect(201);
    token = resReg.body.accessToken;

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
    userId = dbUser.id;

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });

    // Create test department
    const dept = await prisma.department.create({
      data: {
        name: `Analytics Dept ${suffix}`,
        slug: `analytics-dept-${suffix}`,
      },
    });
    departmentId = dept.id;

    // Seed test customer, project, and invoice
    await prisma.customer.create({
      data: {
        name: `Acme Reporting ${suffix}`,
        email: `contact-${suffix}@acme.local`,
        departmentId,
      },
    });

    await prisma.project.create({
      data: {
        name: `Project Analytics ${suffix}`,
        departmentId,
      },
    });

    await prisma.invoice.create({
      data: {
        number: `INV-REP-${suffix}`,
        amount: 2500.0,
        departmentId,
      },
    });
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { departmentId } });
    await prisma.project.deleteMany({ where: { departmentId } });
    await prisma.lead.deleteMany({ where: { departmentId } });
    await prisma.customer.deleteMany({ where: { departmentId } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('provides filtered department summary reports with accurate aggregations', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reports/department-summary?departmentId=${departmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    const summary = res.body[0];
    expect(summary.department.id).toBe(departmentId);
    expect(summary.customers).toBe(1);
    expect(summary.projects).toBe(1);
    expect(summary.invoices).toBe(1);
    expect(parseFloat(summary.invoiceAmount)).toBe(2500);
  });

  it('exports customers and leads cleanly with audit log trail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reports/export?entity=customers&departmentId=${departmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.entity).toBe('customers');
    expect(res.body.count).toBe(1);
    expect(res.body.records[0].name).toContain('Acme Reporting');

    // Verify audit log entry was created
    const audit = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'DATA_EXPORTED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.entityType).toBe('customers');
  });

  it('imports bulk records transactionally with audit logging', async () => {
    const importPayload = {
      entity: 'leads',
      departmentId,
      records: [
        { title: `Imported Lead 1 ${suffix}`, source: 'Referral', value: 1200 },
        { title: `Imported Lead 2 ${suffix}`, source: 'Web', value: 3400 },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/reports/import')
      .set('Authorization', `Bearer ${token}`)
      .send(importPayload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.importedCount).toBe(2);

    // Verify records exist in database
    const leadsInDb = await prisma.lead.findMany({ where: { departmentId } });
    expect(leadsInDb.length).toBe(2);

    // Verify audit log entry
    const audit = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'DATA_IMPORTED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.entityType).toBe('leads');
  });
});
