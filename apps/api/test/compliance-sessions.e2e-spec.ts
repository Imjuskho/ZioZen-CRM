import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Compliance audit and session management (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const organizationId = `compliance-org-${suffix}`;
  const departmentId = `compliance-dept-${suffix}`;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    await prisma.organization.create({ data: { id: organizationId, name: `Compliance ${suffix}`, slug: `compliance-${suffix}` } });
    await prisma.department.create({ data: { id: departmentId, name: `Compliance Dept ${suffix}`, slug: `compliance-dept-${suffix}`, organizationId } });
    const user = await prisma.user.create({ data: { email: `compliance-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Compliance', lastName: 'Admin', role: 'ADMIN', organizationId } });
    userId = user.id;
    await prisma.auditLog.createMany({ data: [{ organizationId, actorId: userId, departmentId, action: 'profile.updated', entityType: 'Organization', metadata: { field: 'timezone' } }, { organizationId, actorId: userId, departmentId, action: 'session.revoked', entityType: 'Session' }] });
    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('lists active sessions and revokes the current session', async () => {
    const sessions = await request(app.getHttpServer()).get('/auth/sessions').set('Authorization', `Bearer ${token}`).expect(200);
    expect(sessions.body.length).toBeGreaterThanOrEqual(1);
    const sessionId = sessions.body[0].id;
    await request(app.getHttpServer()).delete(`/auth/sessions/${sessionId}`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('returns organization-scoped audit events and compliance aggregates', async () => {
    const freshToken = (await request(app.getHttpServer()).post('/auth/login').send({ email: `compliance-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
    const logs = await request(app.getHttpServer()).get('/audit-logs?action=profile.updated').set('Authorization', `Bearer ${freshToken}`).expect(200);
    expect(logs.body).toHaveLength(1);
    expect(logs.body[0].organizationId).toBe(organizationId);
    const report = await request(app.getHttpServer()).get('/audit-logs/compliance-report').set('Authorization', `Bearer ${freshToken}`).expect(200);
    expect(report.body.organizationId).toBe(organizationId);
    expect(report.body.events).toBeGreaterThanOrEqual(2);
    expect(report.body.sessions.active).toBeGreaterThanOrEqual(1);
  });

  it('emits threshold alerts for suspicious audit activity', async () => {
    await prisma.auditLog.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ organizationId, actorId: userId, action: 'access.denied', entityType: 'AccessGrant', ipAddress: '10.0.0.9', requestId: `alert-${index}` })) });
    const freshToken = (await request(app.getHttpServer()).post('/auth/login').send({ email: `compliance-${suffix}@example.test`, password: 'Password123!' }).expect(201)).body.accessToken;
    const alerts = await request(app.getHttpServer()).get('/audit-logs/alerts?hours=24&suspiciousThreshold=3').set('Authorization', `Bearer ${freshToken}`).expect(200);
    expect(alerts.body.alerts.some((alert: { code: string }) => alert.code === 'SUSPICIOUS_AUDIT_ACTIVITY')).toBe(true);
    expect(alerts.body.alerts.some((alert: { code: string }) => alert.code === 'IP_ACTIVITY_SPIKE')).toBe(true);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.department.delete({ where: { id: departmentId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await app.close(); await prisma.$disconnect();
  });
});
