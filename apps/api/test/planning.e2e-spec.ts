import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Wave 6 planning (e2e)', () => {
  let app: INestApplication<App>; const prisma = new PrismaClient(); const suffix = Date.now().toString();
  const departmentId = `planning-${suffix}`; const otherDepartmentId = `planning-other-${suffix}`; let userId: string; let token: string;
  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `Planning ${suffix}`, slug: `planning-${suffix}` }, { id: otherDepartmentId, name: `Planning Other ${suffix}`, slug: `planning-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `planning-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Planning', lastName: 'Owner', role: 'MEMBER' } });
    userId = user.id; await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `planning-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
  });
  it('creates an OKR and calculates key-result status with exact decimals', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const goal = await request(app.getHttpServer()).post('/planning/goals').set(auth).send({ departmentId, title: 'Improve delivery', periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-12-31T00:00:00.000Z', keyResults: [{ title: 'On-time delivery rate', target: '100.00', current: '75.50', unit: 'percent' }] }).expect(201);
    const updated = await request(app.getHttpServer()).post(`/planning/key-results/${goal.body.keyResults[0].id}`).set(auth).send({ current: '100.00' }).expect(201);
    expect(updated.body.status).toBe('completed');
  });
  it('prevents overlapping appointments for the same owner', async () => {
    const auth = { Authorization: `Bearer ${token}` }; const startsAt = '2026-11-10T10:00:00.000Z'; const endsAt = '2026-11-10T11:00:00.000Z';
    await request(app.getHttpServer()).post('/planning/appointments').set(auth).send({ departmentId, title: 'Customer review', startsAt, endsAt }).expect(201);
    await request(app.getHttpServer()).post('/planning/appointments').set(auth).send({ departmentId, title: 'Collision', startsAt: '2026-11-10T10:30:00.000Z', endsAt: '2026-11-10T11:30:00.000Z' }).expect(409);
  });
  it('creates a department-scoped recurring task', async () => {
    const auth = { Authorization: `Bearer ${token}` }; await request(app.getHttpServer()).post('/planning/recurring-tasks').set(auth).send({ departmentId, title: 'Weekly delivery review', frequency: 'weekly', nextRunAt: '2026-11-13T09:00:00.000Z' }).expect(201);
  });
  it('rejects planning writes outside the user department', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/planning/goals').set(auth).send({ departmentId: otherDepartmentId, title: 'Out of scope goal', periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-12-31T00:00:00.000Z', keyResults: [{ title: 'Scope check', target: '1', current: '0', unit: 'count' }] }).expect(403);
    await request(app.getHttpServer()).post('/planning/appointments').set(auth).send({ departmentId: otherDepartmentId, title: 'Out of scope appointment', startsAt: '2026-11-12T10:00:00.000Z', endsAt: '2026-11-12T11:00:00.000Z' }).expect(403);
  });
  afterAll(async () => {
    await prisma.keyResult.deleteMany({ where: { goal: { departmentId } } }); await prisma.goal.deleteMany({ where: { departmentId } }); await prisma.appointment.deleteMany({ where: { departmentId } }); await prisma.recurringTask.deleteMany({ where: { departmentId } }); await prisma.userDepartment.deleteMany({ where: { userId } }); await prisma.user.delete({ where: { id: userId } }); await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } }); await app.close(); await prisma.$disconnect();
  });
});
