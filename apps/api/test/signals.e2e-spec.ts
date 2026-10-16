import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Operational signals (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `signals-dept-${suffix}`;
  const otherDepartmentId = `signals-other-${suffix}`;
  let userId: string;
  let token: string;
  let signalId: string;
  let otherSignalId: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `Signals ${suffix}`, slug: `signals-${suffix}` }, { id: otherDepartmentId, name: `Signals Other ${suffix}`, slug: `signals-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `signals-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Signal', lastName: 'Owner' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const customer = await prisma.customer.create({ data: { name: 'Signal Customer', departmentId } });
    await prisma.project.create({ data: { name: 'Active delivery', departmentId, customerId: customer.id, status: 'active' } });
    await prisma.invoice.create({ data: { number: `SIG-${suffix}`, amount: '240', status: 'overdue', departmentId, customerId: customer.id } });
    await prisma.operationalSignal.create({ data: { type: 'private_test', severity: 'high', status: 'open', title: 'Scoped signal', explanation: 'Department scope test', entityType: 'Customer', entityId: customer.id, customerId: customer.id, departmentId, ownerId: userId, evidence: { create: { sourceType: 'Customer', sourceId: customer.id, metric: 'test', observedValue: 'yes' } } } }).then((signal) => { signalId = signal.id; });
    await prisma.operationalSignal.create({ data: { type: 'other_private_test', severity: 'high', status: 'open', title: 'Other scoped signal', explanation: 'Other department test', entityType: 'Customer', entityId: customer.id, customerId: customer.id, departmentId: otherDepartmentId } }).then((signal) => { otherSignalId = signal.id; });
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `signals-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('returns evidence-backed signals, supports actions, and keeps a customer timeline scoped', async () => {
    const list = await request(app.getHttpServer()).get('/signals?status=open').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.some((signal: { id: string }) => signal.id === signalId)).toBe(true);
    const evidence = await request(app.getHttpServer()).get(`/signals/${signalId}/evidence`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(evidence.body[0].metric).toBe('test');
    const metrics = await request(app.getHttpServer()).get('/signals/metrics/summary').set('Authorization', `Bearer ${token}`).expect(200);
    expect(metrics.body.byStatus.open).toBeGreaterThan(0);
    await request(app.getHttpServer()).post('/signals/rules/ticket_past_target').set('Authorization', `Bearer ${token}`).send({ departmentId, enabled: false, thresholdHours: 48, cooldownHours: 72 }).expect(201);
    const rules = await request(app.getHttpServer()).get('/signals/rules/list').set('Authorization', `Bearer ${token}`).expect(200);
    expect(rules.body[0].cooldownHours).toBe(72);
    await request(app.getHttpServer()).post(`/signals/${signalId}/snooze`).set('Authorization', `Bearer ${token}`).send({ until: new Date(Date.now() + 3600000).toISOString() }).expect(201);
    await request(app.getHttpServer()).post(`/signals/${signalId}/resolve`).set('Authorization', `Bearer ${token}`).send({ reason: 'Handled in test' }).expect(201);
    const customerId = (await prisma.customer.findFirstOrThrow({ where: { departmentId }, select: { id: true } })).id;
    const timeline = await request(app.getHttpServer()).get(`/customers/${customerId}/timeline`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(timeline.body.some((event: { type: string }) => event.type === 'invoice')).toBe(true);
    const otherCustomer = await prisma.customer.create({ data: { name: 'Other customer', departmentId: otherDepartmentId } });
    await request(app.getHttpServer()).get(`/customers/${otherCustomer.id}/timeline`).set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('denies every scoped signal action outside the user department', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).get(`/signals/${otherSignalId}/evidence`).set(auth).expect(403);
    await request(app.getHttpServer()).post(`/signals/${otherSignalId}/resolve`).set(auth).send({ reason: 'No access' }).expect(403);
    await request(app.getHttpServer()).post(`/signals/${otherSignalId}/dismiss`).set(auth).send({ reason: 'No access' }).expect(403);
    await request(app.getHttpServer()).post(`/signals/${otherSignalId}/snooze`).set(auth).send({ until: new Date(Date.now() + 3600000).toISOString() }).expect(403);
    await request(app.getHttpServer()).post(`/signals/${otherSignalId}/reassign`).set(auth).send({ ownerId: userId }).expect(403);
    await request(app.getHttpServer()).post('/signals/rules/other_private_test').set(auth).send({ departmentId: otherDepartmentId, thresholdHours: 4, cooldownHours: 8 }).expect(403);
    const metrics = await request(app.getHttpServer()).get('/signals/metrics/summary').set(auth).expect(200);
    const scopedCount = await prisma.operationalSignal.count({ where: { departmentId } });
    expect(metrics.body.totalCreated).toBe(scopedCount);
  });

  it('requires and stores a dismissal reason', async () => {
    const signal = await prisma.operationalSignal.create({ data: { type: 'dismissal_test', severity: 'low', status: 'open', title: 'Dismissal test', explanation: 'Reason test', entityType: 'Customer', entityId: signalId, departmentId, ownerId: userId } });
    await request(app.getHttpServer()).post(`/signals/${signal.id}/dismiss`).set('Authorization', `Bearer ${token}`).send({}).expect(400);
    await request(app.getHttpServer()).post(`/signals/${signal.id}/dismiss`).set('Authorization', `Bearer ${token}`).send({ reason: 'Not actionable for this team' }).expect(201);
    const stored = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: signal.id } });
    expect(stored.dismissalReason).toBe('Not actionable for this team');
  });

  afterAll(async () => {
    await prisma.signalAction.deleteMany({ where: { signal: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.signalEvidence.deleteMany({ where: { signal: { departmentId: { in: [departmentId, otherDepartmentId] } } } });
    await prisma.operationalSignal.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.signalRule.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.invoice.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.project.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.customer.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
    await app.close();
    await prisma.$disconnect();
  });
});
