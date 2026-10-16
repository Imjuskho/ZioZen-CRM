import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Customer-to-cash vertical slice (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `cash-dept-${suffix}`;
  const otherDepartmentId = `cash-other-${suffix}`;
  let userId: string;
  let token: string;
  let customerId: string;
  let projectId: string;
  let taskId: string;
  let invoiceId: string;
  let foreignCustomerId: string;
  let foreignLeadId: string;
  let foreignProjectId: string;
  let foreignTaskId: string;
  let foreignInvoiceId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.department.createMany({ data: [
      { id: departmentId, name: `Cash ${suffix}`, slug: `cash-${suffix}` },
      { id: otherDepartmentId, name: `Cash Other ${suffix}`, slug: `cash-other-${suffix}` },
    ] });
    const user = await prisma.user.create({ data: { email: `cash-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Cash', lastName: 'Owner', role: 'MEMBER' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });

    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `cash-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;

    const foreignCustomer = await prisma.customer.create({ data: { name: 'Foreign Customer', email: `foreign-${suffix}@example.test`, departmentId: otherDepartmentId } });
    foreignCustomerId = foreignCustomer.id;
    foreignLeadId = (await prisma.lead.create({ data: { title: 'Foreign Lead', departmentId: otherDepartmentId, ownerId: userId } })).id;
    foreignProjectId = (await prisma.project.create({ data: { name: 'Foreign Project', departmentId: otherDepartmentId, customerId: foreignCustomerId, ownerId: userId } })).id;
    foreignTaskId = (await prisma.task.create({ data: { title: 'Foreign Task', departmentId: otherDepartmentId, projectId: foreignProjectId, customerId: foreignCustomerId } })).id;
    foreignInvoiceId = (await prisma.invoice.create({ data: { number: `FOREIGN-${suffix}`, amount: '25.00', departmentId: otherDepartmentId, customerId: foreignCustomerId } })).id;
  });

  it('runs lead → customer → project → task → invoice → payment', async () => {
    const lead = await request(app.getHttpServer()).post('/leads').set(auth()).send({ title: 'Acme expansion', source: 'referral', email: `acme-${suffix}@example.test`, value: '1250.00', departmentId }).expect(201);
    const converted = await request(app.getHttpServer()).post(`/leads/${lead.body.id}/convert`).set(auth()).send({ companyName: 'Acme Services', projectName: 'Acme implementation' }).expect(201);
    customerId = converted.body.customer.id;
    projectId = converted.body.project.id;
    expect(converted.body.lead.status).toBe('converted');
    expect(converted.body.customer.departmentId).toBe(departmentId);

    const task = await request(app.getHttpServer()).post('/tasks').set(auth()).send({ title: 'Configure Acme workspace', departmentId, projectId, customerId }).expect(201);
    taskId = task.body.id;
    expect(task.body.projectId).toBe(projectId);

    const invoice = await request(app.getHttpServer()).post('/invoices').set(auth()).send({ number: `ACME-${suffix}`, amount: '1250.00', departmentId, customerId, status: 'draft', currency: 'USD' }).expect(201);
    invoiceId = invoice.body.id;
    const payment = await request(app.getHttpServer()).post(`/invoices/${invoiceId}/payments`).set(auth()).send({ amount: '1250.00', method: 'bank_transfer', transactionId: `tx-${suffix}` }).expect(201);
    expect(payment.body.invoiceStatus).toBe('paid');
    expect(payment.body.totalPaid).toBe('1250');
    expect(payment.body.outstandingBalance).toBe('0');

    const timeline = await request(app.getHttpServer()).get(`/customers/${customerId}/timeline`).set(auth()).expect(200);
    expect(Array.isArray(timeline.body)).toBe(true);
    expect((await request(app.getHttpServer()).get('/invoices').set(auth()).expect(200)).body.some((item: { id: string }) => item.id === invoiceId)).toBe(true);
    expect((await request(app.getHttpServer()).get('/tasks').set(auth()).expect(200)).body.some((item: { id: string }) => item.id === taskId)).toBe(true);
  });

  it('denies access to every customer-to-cash record outside the user department', async () => {
    const scopedRequests = [
      () => request(app.getHttpServer()).get(`/leads/${foreignLeadId}`),
      () => request(app.getHttpServer()).get(`/customers/${foreignCustomerId}/timeline`),
      () => request(app.getHttpServer()).delete(`/projects/${foreignProjectId}`),
      () => request(app.getHttpServer()).put(`/tasks/${foreignTaskId}/status`).send({ status: 'done' }),
      () => request(app.getHttpServer()).get(`/invoices/${foreignInvoiceId}`),
      () => request(app.getHttpServer()).post(`/invoices/${foreignInvoiceId}/payments`).send({ amount: '25.00' }),
    ];
    for (const makeRequest of scopedRequests) await makeRequest().set(auth()).expect(403);
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoice: { number: { in: [`ACME-${suffix}`, `FOREIGN-${suffix}`] } } } });
    await prisma.invoice.deleteMany({ where: { number: { in: [`ACME-${suffix}`, `FOREIGN-${suffix}`] } } });
    await prisma.task.deleteMany({ where: { id: { in: [taskId, foreignTaskId].filter(Boolean) } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, foreignProjectId].filter(Boolean) } } });
    await prisma.lead.deleteMany({ where: { id: { in: [foreignLeadId].filter(Boolean) } } });
    await prisma.customer.deleteMany({ where: { id: { in: [customerId, foreignCustomerId].filter(Boolean) } } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.journalEntry.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.account.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
    await app.close();
    await prisma.$disconnect();
  });
});
