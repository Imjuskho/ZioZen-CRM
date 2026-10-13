import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Administration & Extensibility Workflows (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const userEmail = `admin-ext-${suffix}@crm.local`;
  const password = 'StrongPassword123!';
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Register test admin
    const resReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password, firstName: 'Admin', lastName: 'Ext' })
      .expect(201);
    token = resReg.body.accessToken;

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
    userId = dbUser.id;

    // Promote to ADMIN
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: userId },
    });
    await prisma.webhook.deleteMany({
      where: { ownerId: userId },
    });
    await prisma.customFieldValue.deleteMany({
      where: { entityType: `Customer-${suffix}` },
    });
    await prisma.customField.deleteMany({
      where: { entityType: `Customer-${suffix}` },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it('creates custom field definitions, assigns values, and reads back with audit trail', async () => {
    // 1. Create a custom field definition
    const fieldRes = await request(app.getHttpServer())
      .post('/custom-fields')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entityType: `Customer-${suffix}`,
        name: `tax_id_${suffix}`,
        label: 'Tax Identification Number',
        fieldType: 'string',
        required: false,
      })
      .expect(201);

    expect(fieldRes.body.id).toBeDefined();
    expect(fieldRes.body.name).toBe(`tax_id_${suffix}`);
    const customFieldId = fieldRes.body.id;

    // 2. Set custom field value for an entity
    const targetEntityId = `cust-${suffix}`;
    const valueRes = await request(app.getHttpServer())
      .post('/custom-fields/values')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customFieldId,
        entityType: `Customer-${suffix}`,
        entityId: targetEntityId,
        value: 'US-987654321',
      })
      .expect(201);

    expect(valueRes.body.value).toBe('US-987654321');

    // 3. Query custom field values
    const getValuesRes = await request(app.getHttpServer())
      .get(`/custom-fields/values?entityType=Customer-${suffix}&entityId=${targetEntityId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getValuesRes.body).toHaveLength(1);
    expect(getValuesRes.body[0].value).toBe('US-987654321');

    // 4. Verify audit trail
    const auditLogs = await prisma.auditLog.findMany({
      where: { actorId: userId },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('CUSTOM_FIELD_CREATED');
    expect(actions).toContain('CUSTOM_FIELD_VALUE_UPDATED');
  });

  it('configures outbound webhooks and logs audit configuration', async () => {
    // 1. Configure webhook
    const hookRes = await request(app.getHttpServer())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Zapier Lead Sync ${suffix}`,
        url: 'https://hooks.zapier.com/hooks/catch/12345/abcde/',
        events: ['lead.created', 'invoice.paid'],
        secret: 'whsec_test_secret_123',
      })
      .expect(201);

    expect(hookRes.body.id).toBeDefined();
    expect(hookRes.body.active).toBe(true);

    // 2. List webhooks
    const listRes = await request(app.getHttpServer())
      .get('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.some((w: { id: string }) => w.id === hookRes.body.id)).toBe(true);

    // 3. Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Webhook', entityId: hookRes.body.id },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('WEBHOOK_CONFIGURED');
  });
});
