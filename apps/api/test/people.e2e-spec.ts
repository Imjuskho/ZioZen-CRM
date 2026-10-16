import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('People, leave, approvals and payroll (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentId = `people-dept-${suffix}`;
  const otherDepartmentId = `people-other-${suffix}`;
  let userId: string;
  let employeeId: string;
  let token: string;
  let approverId: string;
  let approverToken: string;

  beforeAll(async () => {
    await prisma.department.createMany({ data: [{ id: departmentId, name: `People ${suffix}`, slug: `people-${suffix}` }, { id: otherDepartmentId, name: `People Other ${suffix}`, slug: `people-other-${suffix}` }] });
    const user = await prisma.user.create({ data: { email: `people-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'People', lastName: 'Owner', role: 'MANAGER' } });
    userId = user.id;
    await prisma.userDepartment.create({ data: { userId, departmentId, isPrimary: true } });
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: `people-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
    const approver = await prisma.user.create({ data: { email: `people-approver-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Payroll', lastName: 'Approver', role: 'MANAGER' } });
    approverId = approver.id;
    await prisma.userDepartment.create({ data: { userId: approverId, departmentId, isPrimary: true } });
    approverToken = (await request(app.getHttpServer()).post('/auth/login').send({ email: approver.email, password: 'Password123!' }).expect(201)).body.accessToken;
    employeeId = (await request(app.getHttpServer()).post('/people/employees').set('Authorization', `Bearer ${token}`).send({ userId, departmentId, jobTitle: 'Operator', salary: '3000.00', startDate: '2026-01-01T00:00:00.000Z' }).expect(201)).body.id;
  });

  it('creates a scoped leave request and rejects an overlap', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/people/leave-requests').set(auth).send({ employeeId, type: 'annual', startDate: '2026-10-10T00:00:00.000Z', endDate: '2026-10-15T00:00:00.000Z' }).expect(201);
    await request(app.getHttpServer()).post('/people/leave-requests').set(auth).send({ employeeId, type: 'sick', startDate: '2026-10-12T00:00:00.000Z', endDate: '2026-10-14T00:00:00.000Z' }).expect(409);
    await request(app.getHttpServer()).get(`/people/leave-requests?departmentId=${otherDepartmentId}`).set(auth).expect(403);
  });

  it('keeps payroll exact and approval records department-scoped', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const payroll = await request(app.getHttpServer()).post('/people/payroll').set(auth).send({ departmentId, name: 'October 2026', periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-11-01T00:00:00.000Z', lines: [{ employeeId, bonus: '125.10', deductions: '25.10' }] }).expect(201);
    expect(payroll.body.payslips[0].netAmount.toString()).toBe('3100');
    const validation = await request(app.getHttpServer()).get(`/people/payroll/${payroll.body.id}/validation`).set(auth).expect(200);
    expect(validation.body.ready).toBe(true);
    await request(app.getHttpServer()).post(`/people/payroll/${payroll.body.id}/approve`).set(auth).expect(409);
    await request(app.getHttpServer()).post(`/people/payroll/${payroll.body.id}/approve`).set({ Authorization: `Bearer ${approverToken}` }).expect(201);
    const exported = await request(app.getHttpServer()).post(`/people/payroll/${payroll.body.id}/export`).set({ Authorization: `Bearer ${approverToken}` }).expect(201);
    expect(exported.body.format).toBe('csv');
    expect(exported.body.operationalOnly).toBe(true);
    expect(exported.body.content).toContain('employee_id,email');
    const approval = await request(app.getHttpServer()).post('/people/approvals').set(auth).send({ departmentId, entityType: 'PayrollBatch', entityId: payroll.body.id, requiredRole: 'MANAGER' }).expect(201);
    await request(app.getHttpServer()).get(`/people/approvals?departmentId=${otherDepartmentId}`).set(auth).expect(403);
    await request(app.getHttpServer()).post(`/people/approvals/${approval.body.id}/decision`).set(auth).send({ status: 'approved', note: 'Reviewed' }).expect(201);
  });

  afterAll(async () => {
    await prisma.payslip.deleteMany({ where: { employeeId } });
    await prisma.payrollBatch.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.approvalRequest.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.leaveRequest.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.employeeProfile.deleteMany({ where: { departmentId: { in: [departmentId, otherDepartmentId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId: { in: [userId, approverId] } } }); await prisma.user.deleteMany({ where: { id: { in: [userId, approverId] } } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } }); await app.close(); await prisma.$disconnect();
  });
});
