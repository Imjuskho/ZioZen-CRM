import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Support & Knowledge Management (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const dept1Id = `dept-supp1-${suffix}`;
  const dept2Id = `dept-supp2-${suffix}`;
  const user1Email = `supp1-${suffix}@crm.local`;
  const user2Email = `supp2-${suffix}@crm.local`;
  const password = 'StrongPassword123!';

  let token1: string;
  let token2: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Create departments
    await prisma.department.createMany({
      data: [
        { id: dept1Id, name: `Support Dept 1 ${suffix}`, slug: `supp1-${suffix}` },
        { id: dept2Id, name: `Support Dept 2 ${suffix}`, slug: `supp2-${suffix}` },
      ],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 2. Register users
    const resReg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user1Email, password, firstName: 'Agent', lastName: 'One' })
      .expect(201);
    token1 = resReg1.body.accessToken;

    const resReg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password, firstName: 'Agent', lastName: 'Two' })
      .expect(201);
    token2 = resReg2.body.accessToken;

    const dbUser1 = await prisma.user.findUniqueOrThrow({ where: { email: user1Email } });
    const dbUser2 = await prisma.user.findUniqueOrThrow({ where: { email: user2Email } });
    user1Id = dbUser1.id;
    user2Id = dbUser2.id;

    // 3. Department memberships
    await prisma.userDepartment.createMany({
      data: [
        { userId: user1Id, departmentId: dept1Id, isPrimary: true },
        { userId: user2Id, departmentId: dept2Id, isPrimary: true },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.ticketReply.deleteMany({
      where: { ticket: { departmentId: { in: [dept1Id, dept2Id] } } },
    });
    await prisma.ticket.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.knowledgeArticle.deleteMany({
      where: { slug: { contains: suffix } },
    });
    await prisma.userDepartment.deleteMany({
      where: { userId: { in: [user1Id, user2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1Id, user2Id] } },
    });
    await prisma.department.deleteMany({
      where: { id: { in: [dept1Id, dept2Id] } },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it('manages support ticket lifecycle, internal notes vs public replies, and department isolation', async () => {
    // 1. Create a support ticket in Dept 1
    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        subject: 'API Webhook Delivery Intermittent Failure',
        message: 'Webhooks failing with 504 gateway timeout during peak spikes.',
        departmentId: dept1Id,
        priority: 'high',
      })
      .expect(201);

    expect(ticketRes.body.id).toBeDefined();
    expect(ticketRes.body.status).toBe('open');
    expect(ticketRes.body.priority).toBe('high');
    const ticketId = ticketRes.body.id;

    // 2. Negative authorization: User 2 (Dept 2) cannot see or modify Dept 1 ticket
    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ status: 'closed' })
      .expect(403);

    // 3. Post public reply from support agent (User 1)
    const replyRes = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/replies`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        body: 'We are investigating the connection pool scaling policy.',
        internal: false,
      })
      .expect(201);

    expect(replyRes.body.internal).toBe(false);

    // 4. Post internal staff-only note
    const noteRes = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/replies`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        body: 'INTERNAL NOTE: Found Redis worker concurrency throttled at 5 threads.',
        internal: true,
      })
      .expect(201);

    expect(noteRes.body.internal).toBe(true);

    // 5. Update ticket status to in-progress
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ status: 'in-progress' })
      .expect(200);

    // 6. Inspect ticket detail with all replies
    const detailRes = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(detailRes.body.status).toBe('in-progress');
    expect(detailRes.body.replies).toHaveLength(2);
    expect(detailRes.body.replies.some((r: { internal: boolean }) => r.internal === true)).toBe(true);
    expect(detailRes.body.replies.some((r: { internal: boolean }) => r.internal === false)).toBe(true);

    // 7. Verify audit logs recorded actions
    const auditLogs = await prisma.auditLog.findMany({
      where: { departmentId: dept1Id },
    });
    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('TICKET_CREATED');
    expect(actions).toContain('TICKET_REPLY_ADDED');
    expect(actions).toContain('TICKET_INTERNAL_NOTE_ADDED');
    expect(actions).toContain('TICKET_UPDATED');
  });

  it('creates and reads published knowledge base articles', async () => {
    // 1. Create a published KB article
    const kbRes = await request(app.getHttpServer())
      .post('/knowledge-base')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: `Configuring Webhooks Guide ${suffix}`,
        slug: `webhooks-guide-${suffix}`,
        content: 'Comprehensive guide to configuring outbound webhooks and retry rules.',
        category: 'Integrations',
        published: true,
      })
      .expect(201);

    expect(kbRes.body.id).toBeDefined();

    // 2. Query published KB articles
    const listRes = await request(app.getHttpServer())
      .get('/knowledge-base')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(listRes.body.some((a: { slug: string }) => a.slug === `webhooks-guide-${suffix}`)).toBe(true);
  });
});
