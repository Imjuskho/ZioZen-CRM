import { INestApplication } from '@nestjs/common';
import { createServer } from 'node:http';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Enterprise export center (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  let organizationId: string;
  let userId: string;
  let token: string;
  let webhookId: string;
  let notificationServer: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: `Export Org ${suffix}`, slug: `export-org-${suffix}` } });
    organizationId = organization.id;
    const user = await prisma.user.create({ data: { email: `export-${suffix}@example.test`, passwordHash: await bcrypt.hash('Password123!', 10), firstName: 'Export', lastName: 'Admin', role: 'ADMIN', organizationId } });
    userId = user.id;
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); await app.init();
    token = (await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('returns an organization-scoped package without password hashes and records the export', async () => {
    const response = await request(app.getHttpServer()).get('/exports/tenant?includeAudit=true').set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.organization.id).toBe(organizationId);
    expect(response.body.users[0].email).toContain(`export-${suffix}`);
    expect(response.body.users[0].passwordHash).toBeUndefined();
    expect(response.body.counts.users).toBe(1);
    expect(response.body.schemaVersion).toBe('2026-10-14');
    const audit = await prisma.auditLog.findFirst({ where: { organizationId, action: 'TENANT_EXPORT_CREATED' } });
    expect(audit).not.toBeNull();
  });

  it('queues a durable export, tracks progress, and exposes completed history/download', async () => {
    const created = await request(app.getHttpServer()).post('/exports/tenant/jobs?includeAudit=false').set('Authorization', `Bearer ${token}`).expect(201);
    expect(['queued', 'running', 'completed']).toContain(created.body.status);
    let status = created.body;
    for (let attempt = 0; attempt < 20 && status.status !== 'completed' && status.status !== 'failed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      status = (await request(app.getHttpServer()).get(`/exports/tenant/jobs/${created.body.id}`).set('Authorization', `Bearer ${token}`).expect(200)).body;
    }
    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
    expect(status.downloadReady).toBe(true);
    const download = await request(app.getHttpServer()).get(`/exports/tenant/jobs/${created.body.id}/download`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(download.body.organization.id).toBe(organizationId);
    expect(download.body.auditLogs).toBeUndefined();
    const history = await request(app.getHttpServer()).get('/exports/tenant/jobs').set('Authorization', `Bearer ${token}`).expect(200);
    expect(history.body.some((job: { id: string }) => job.id === created.body.id)).toBe(true);
  });

  it('notifies an organization webhook when a queued export completes', async () => {
    const received = new Promise<{ event: string; signature?: string }>((resolve) => {
      notificationServer = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => { res.statusCode = 204; res.end(); resolve({ event: JSON.parse(body).event, signature: req.headers['x-ziozen-signature'] as string | undefined }); });
      });
    });
    await new Promise<void>((resolve) => notificationServer.listen(0, '127.0.0.1', resolve));
    const address = notificationServer.address();
    if (!address || typeof address === 'string') throw new Error('Notification server did not start');
    const webhook = await prisma.webhook.create({ data: { name: 'Export notifications', url: `http://127.0.0.1:${address.port}/export`, events: ['tenant_export.completed'], secret: 'test-secret', ownerId: userId } });
    webhookId = webhook.id;
    const created = await request(app.getHttpServer()).post('/exports/tenant/jobs?includeAudit=false').set('Authorization', `Bearer ${token}`).expect(201);
    const notification = await received;
    expect(notification.event).toBe('tenant_export.completed');
    expect(notification.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(created.body.id).toBeTruthy();
  });

  afterAll(async () => {
    if (webhookId) await prisma.webhook.delete({ where: { id: webhookId } });
    if (notificationServer) await new Promise<void>((resolve) => notificationServer.close(() => resolve()));
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await app.close(); await prisma.$disconnect();
  });
});
