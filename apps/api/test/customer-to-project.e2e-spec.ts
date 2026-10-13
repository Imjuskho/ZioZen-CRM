import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';

describe('Customer to Project Workflow (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  const dept1Id = `dept-wf1-${suffix}`;
  const dept2Id = `dept-wf2-${suffix}`;
  const user1Email = `user1-${suffix}@workflow.local`;
  const user2Email = `user2-${suffix}@workflow.local`;
  const password = 'StrongPassword123!';

  let token1: string;
  let token2: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Create 2 isolated departments
    await prisma.department.createMany({
      data: [
        { id: dept1Id, name: `Workflow Dept 1 ${suffix}`, slug: `wf1-${suffix}` },
        { id: dept2Id, name: `Workflow Dept 2 ${suffix}`, slug: `wf2-${suffix}` },
      ],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 2. Register User 1 and User 2
    const resReg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user1Email, password, firstName: 'User', lastName: 'One' })
      .expect(201);
    token1 = resReg1.body.accessToken;

    const resReg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user2Email, password, firstName: 'User', lastName: 'Two' })
      .expect(201);
    token2 = resReg2.body.accessToken;

    // Get user IDs
    const dbUser1 = await prisma.user.findUniqueOrThrow({ where: { email: user1Email } });
    const dbUser2 = await prisma.user.findUniqueOrThrow({ where: { email: user2Email } });
    user1Id = dbUser1.id;
    user2Id = dbUser2.id;

    // 3. Assign User 1 to Dept 1 and User 2 to Dept 2
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
    await prisma.task.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.project.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
    });
    await prisma.customer.deleteMany({
      where: { departmentId: { in: [dept1Id, dept2Id] } },
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

  it('executes full customer-to-project workflow with audit logging and department isolation', async () => {
    // 1. User 1 creates Customer in Dept 1
    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'Acme Corporation',
        email: 'contact@acme.corp',
        company: 'Acme Corp',
        departmentId: dept1Id,
      })
      .expect(201);

    expect(customerRes.body.id).toBeDefined();
    expect(customerRes.body.name).toBe('Acme Corporation');
    const customerId = customerRes.body.id;

    // 2. User 1 creates Project linked to Customer in Dept 1
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'Acme CRM Implementation',
        description: 'Complete CRM rollout',
        departmentId: dept1Id,
        customerId: customerId,
      })
      .expect(201);

    expect(projectRes.body.id).toBeDefined();
    expect(projectRes.body.customerId).toBe(customerId);
    const projectId = projectRes.body.id;

    // 3. User 1 creates Task linked to Project and Customer in Dept 1
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Initial Discovery Call',
        description: 'Stakeholder kick-off meeting',
        departmentId: dept1Id,
        projectId: projectId,
        customerId: customerId,
      })
      .expect(201);

    expect(taskRes.body.id).toBeDefined();
    expect(taskRes.body.projectId).toBe(projectId);
    expect(taskRes.body.customerId).toBe(customerId);
    const taskId = taskRes.body.id;

    // 4. Update task status
    const taskUpdateRes = await request(app.getHttpServer())
      .put(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ status: 'completed' })
      .expect(200);

    expect(taskUpdateRes.body.status).toBe('completed');

    // 5. Verify User 1 can see their customer, project, and task
    const user1Customers = await request(app.getHttpServer())
      .get('/customers')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    expect(user1Customers.body.some((c: { id: string }) => c.id === customerId)).toBe(true);

    const user1Projects = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    expect(user1Projects.body.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const user1Tasks = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    expect(user1Tasks.body.some((t: { id: string }) => t.id === taskId)).toBe(true);

    // 6. NEGATIVE AUTHORIZATION: User 2 (Dept 2) CANNOT see Dept 1 customer, project, or task
    const user2Customers = await request(app.getHttpServer())
      .get('/customers')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    expect(user2Customers.body.some((c: { id: string }) => c.id === customerId)).toBe(false);

    const user2Projects = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    expect(user2Projects.body.some((p: { id: string }) => p.id === projectId)).toBe(false);

    const user2Tasks = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    expect(user2Tasks.body.some((t: { id: string }) => t.id === taskId)).toBe(false);

    // 7. NEGATIVE AUTHORIZATION: User 2 CANNOT create a project or task in Dept 1
    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        name: 'Intruder Project',
        departmentId: dept1Id,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        title: 'Intruder Task',
        departmentId: dept1Id,
      })
      .expect(403);

    // 8. NEGATIVE AUTHORIZATION: User 2 CANNOT update or delete Dept 1 task or project
    await request(app.getHttpServer())
      .put(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ status: 'hijacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    // 9. VERIFY AUDIT TRAIL
    const auditLogs = await prisma.auditLog.findMany({
      where: { departmentId: dept1Id },
      orderBy: { createdAt: 'asc' },
    });

    const actions = auditLogs.map((a) => a.action);
    expect(actions).toContain('CUSTOMER_CREATED');
    expect(actions).toContain('PROJECT_CREATED');
    expect(actions).toContain('TASK_CREATED');
    expect(actions).toContain('TASK_STATUS_UPDATED');
  });
});
