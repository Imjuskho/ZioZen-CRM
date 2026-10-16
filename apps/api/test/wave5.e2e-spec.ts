import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Wave 5 automation and inbox (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `wave5-dept-${suffix}`;
  const otherDepartmentId = `wave5-other-${suffix}`;
  let userId: string;
  let customerId: string;
  let token: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `Wave 5 ${suffix}`, slug: `wave5-${suffix}` }, { id: otherDepartmentId, name: `Wave 5 Other ${suffix}`, slug: `wave5-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `wave5-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Wave', lastName: 'Five', role: 'MEMBER' } });
    userId = user.id; await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const customer = await prisma.customer.create({ data: { name: 'Matched Customer', email: `match-${suffix}@example.test`, departmentId } }); customerId = customer.id;
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `wave5-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('executes a rule once for a repeated event', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/automation/rules').set(auth).send({ departmentId, name: 'Create overdue signal', eventType: 'invoice.overdue', conditions: { status: 'overdue' }, action: { type: 'CREATE_SIGNAL', severity: 'high', title: 'Invoice needs collection' } }).expect(201);
    const event = { eventId: `evt-${suffix}`, eventType: 'invoice.overdue', departmentId, payload: { status: 'overdue', entityType: 'Invoice', entityId: `invoice-${suffix}`, customerId } };
    const first = await request(app.getHttpServer()).post('/automation/events').set(auth).send(event).expect(201);
    const second = await request(app.getHttpServer()).post('/automation/events').set(auth).send(event).expect(201);
    expect(first.body.matchedRules).toBe(1); expect(second.body.matchedRules).toBe(1);
    expect(await prisma.operationalSignal.count({ where: { entityId: `invoice-${suffix}` } })).toBe(1);
    expect(await prisma.automationRun.count({ where: { eventId: `evt-${suffix}` } })).toBe(1);
  });

  it('rejects automation and inbox writes outside the user department', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/automation/rules').set(auth).send({ departmentId: otherDepartmentId, name: 'Out of scope rule', eventType: 'invoice.overdue', conditions: {}, action: { type: 'CREATE_SIGNAL' } }).expect(403);
    await request(app.getHttpServer()).post('/inbox/channels').set(auth).send({ departmentId: otherDepartmentId, channel: 'email', secret: 'out-of-scope' }).expect(403);
  });

  it('records failed runs, dead-letters after three attempts, and supports replay', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const rule = await prisma.automationRule.create({ data: { departmentId, name: 'Always fail for reliability test', eventType: 'reliability.test', conditions: {}, action: { type: 'UNSUPPORTED_ACTION' }, createdById: userId } });
    const event = { eventId: `reliability-${suffix}`, eventType: 'reliability.test', departmentId, payload: {} };
    await request(app.getHttpServer()).post('/automation/events').set(auth).send(event).expect(201);
    let run = await prisma.automationRun.findUniqueOrThrow({ where: { ruleId_eventId: { ruleId: rule.id, eventId: event.eventId } } });
    expect(run.status).toBe('failed'); expect(run.attempts).toBe(1); expect(run.nextRetryAt).not.toBeNull();
    await request(app.getHttpServer()).post(`/automation/runs/${run.id}/replay`).set(auth).expect(201);
    await request(app.getHttpServer()).post(`/automation/runs/${run.id}/replay`).set(auth).expect(201);
    run = await prisma.automationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(run.status).toBe('dead_lettered'); expect(run.attempts).toBe(3); expect(run.deadLetteredAt).not.toBeNull();
    await request(app.getHttpServer()).post(`/automation/runs/${run.id}/replay`).set(auth).expect(201);
    run = await prisma.automationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(run.status).toBe('failed'); expect(run.attempts).toBe(1);
  });

  it('rejects invalid inbox secrets and matches inbound messages to customers', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/inbox/channels').set(auth).send({ departmentId, channel: 'webchat', secret: 'inbox-secret' }).expect(201);
    const payload = { eventId: `message-${suffix}`, externalThreadId: `thread-${suffix}`, sender: 'Customer', email: `match-${suffix}@example.test`, body: 'Hello from the customer' };
    await request(app.getHttpServer()).post('/inbox/webhooks/webchat').set('x-inbox-secret', 'wrong').send(payload).expect(403);
    const received = await request(app.getHttpServer()).post('/inbox/webhooks/webchat').set('x-inbox-secret', 'inbox-secret').send(payload).expect(201);
    expect(received.body.customerId).toBe(customerId);
    const duplicate = await request(app.getHttpServer()).post('/inbox/webhooks/webchat').set('x-inbox-secret', 'inbox-secret').send(payload).expect(201);
    expect(duplicate.body.id).toBe(received.body.id);
  });

  afterAll(async () => {
    await prisma.inboxMessage.deleteMany({ where: { thread: { departmentId } } }); await prisma.inboxThread.deleteMany({ where: { departmentId } }); await prisma.inboxChannel.deleteMany({ where: { departmentId } });
    await prisma.automationRun.deleteMany({ where: { rule: { departmentId } } }); await prisma.automationRule.deleteMany({ where: { departmentId } }); await prisma.operationalSignal.deleteMany({ where: { departmentId } });
    await prisma.customer.delete({ where: { id: customerId } }); await prisma.userDepartment.deleteMany({ where: { userId } }); await prisma.user.delete({ where: { id: userId } }); await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } }); await app.close(); await prisma.$disconnect();
  });
});
