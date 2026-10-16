import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module.js';

describe('Customer portal (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `portal-dept-${suffix}`;
  const otherDepartmentId = `portal-other-${suffix}`;
  let customerId: string;
  let otherCustomerId: string;
  let ticketId: string;
  let invoiceId: string;
  let portalToken: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [
      { id: departmentId, name: `Portal Dept ${suffix}`, slug: `portal-${suffix}` },
      { id: otherDepartmentId, name: `Other Portal Dept ${suffix}`, slug: `other-portal-${suffix}` },
    ] });
    const customer = await prisma.customer.create({ data: { name: `Portal Customer ${suffix}`, email: `portal-${suffix}@example.test`, departmentId } });
    customerId = customer.id;
    const other = await prisma.customer.create({ data: { name: `Other Customer ${suffix}`, departmentId: otherDepartmentId } });
    otherCustomerId = other.id;
    await prisma.customerPortalAccount.create({ data: { customerId, email: `portal-login-${suffix}@example.test`, passwordHash: await bcrypt.hash('PortalPassword123!', 12) } });
    const project = await prisma.project.create({ data: { name: `Visible Project ${suffix}`, customerId, departmentId } });
    const otherProject = await prisma.project.create({ data: { name: `Hidden Project ${suffix}`, customerId: otherCustomerId, departmentId: otherDepartmentId } });
    const invoice = await prisma.invoice.create({ data: { number: `PORTAL-${suffix}`, amount: '125.00', customerId, departmentId } });
    invoiceId = invoice.id;
    const ticket = await prisma.ticket.create({ data: { subject: `Portal issue ${suffix}`, customerId, departmentId } });
    ticketId = ticket.id;
    await prisma.ticketReply.createMany({ data: [
      { ticketId, body: 'Customer-visible update', internal: false },
      { ticketId, body: 'Staff-only investigation', internal: true },
    ] });
    expect(project.id).toBeDefined();
    expect(otherProject.id).toBeDefined();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('authenticates a customer and restricts every portal collection to that customer', async () => {
    const login = await request(app.getHttpServer()).post('/auth/customer-login').send({ email: `portal-login-${suffix}@example.test`, password: 'PortalPassword123!' }).expect(201);
    portalToken = login.body.accessToken;
    expect(login.body.customer.id).toBe(customerId);

    const projects = await request(app.getHttpServer()).get('/customer-portal/projects').set('Authorization', `Bearer ${portalToken}`).expect(200);
    expect(projects.body).toHaveLength(1);
    expect(projects.body[0].name).toContain('Visible Project');

    const invoices = await request(app.getHttpServer()).get('/customer-portal/invoices').set('Authorization', `Bearer ${portalToken}`).expect(200);
    expect(invoices.body).toHaveLength(1);
    expect(invoices.body[0].id).toBe(invoiceId);
    await request(app.getHttpServer()).get(`/customer-portal/invoices/${invoiceId}/html`).set('Authorization', `Bearer ${portalToken}`).expect(200).expect((response) => expect(response.body.html).toContain(`PORTAL-${suffix}`));
    await request(app.getHttpServer()).get(`/customer-portal/invoices/${invoiceId}/document`).set('Authorization', `Bearer ${portalToken}`).expect(200).expect((response) => expect(response.body.html).toContain('meta name="viewport"'));

    const tickets = await request(app.getHttpServer()).get('/customer-portal/tickets').set('Authorization', `Bearer ${portalToken}`).expect(200);
    expect(tickets.body).toHaveLength(1);
    expect(tickets.body[0].replies).toHaveLength(1);
    expect(tickets.body[0].replies[0].body).toBe('Customer-visible update');
    expect(JSON.stringify(tickets.body)).not.toContain('Staff-only investigation');
  });

  it('allows customer ticket creation/replies but rejects cross-customer access', async () => {
    await request(app.getHttpServer()).get(`/customer-portal/invoices/${invoiceId}`).set('Authorization', `Bearer ${portalToken}`).expect(404);
    await request(app.getHttpServer()).get(`/customer-portal/invoices/${(await prisma.invoice.create({ data: { number: `HIDDEN-${suffix}`, amount: '1.00', customerId: otherCustomerId, departmentId: otherDepartmentId } })).id}/html`).set('Authorization', `Bearer ${portalToken}`).expect(404);
    const created = await request(app.getHttpServer()).post('/customer-portal/tickets').set('Authorization', `Bearer ${portalToken}`).send({ subject: 'New portal ticket', message: 'Please help' }).expect(201);
    await request(app.getHttpServer()).post(`/customer-portal/tickets/${ticketId}/replies`).set('Authorization', `Bearer ${portalToken}`).send({ body: 'More customer context' }).expect(201);
    expect(created.body.subject).toBe('New portal ticket');
  });

  afterAll(async () => {
    await prisma.ticketReply.deleteMany({ where: { ticket: { customerId: { in: [customerId, otherCustomerId] } } } });
    await prisma.ticket.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.payment.deleteMany({ where: { invoice: { customerId: { in: [customerId, otherCustomerId] } } } });
    await prisma.invoice.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.project.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.customerPortalAccount.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: { in: [customerId, otherCustomerId] } } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
    await app.close();
    await prisma.$disconnect();
  });
});
