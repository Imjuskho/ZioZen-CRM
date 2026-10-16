import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Enterprise tenant and access isolation (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const orgAId = `org-a-${suffix}`;
  const orgBId = `org-b-${suffix}`;
  const departmentAId = `tenant-dept-a-${suffix}`;
  const departmentBId = `tenant-dept-b-${suffix}`;
  let userAId: string;
  let userBId: string;
  let invitedUserId: string | undefined;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await prisma.organization.createMany({ data: [{ id: orgAId, name: `Tenant A ${suffix}`, slug: `tenant-a-${suffix}` }, { id: orgBId, name: `Tenant B ${suffix}`, slug: `tenant-b-${suffix}` }] });
    await prisma.department.createMany({ data: [{ id: departmentAId, name: `Tenant A Dept ${suffix}`, slug: `tenant-a-dept-${suffix}`, organizationId: orgAId }, { id: departmentBId, name: `Tenant B Dept ${suffix}`, slug: `tenant-b-dept-${suffix}`, organizationId: orgBId }] });
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { email: `tenant-a-${suffix}@example.test`, passwordHash, firstName: 'Tenant', lastName: 'A', role: 'ADMIN', organizationId: orgAId } }),
      prisma.user.create({ data: { email: `tenant-b-${suffix}@example.test`, passwordHash, firstName: 'Tenant', lastName: 'B', role: 'ADMIN', organizationId: orgBId } }),
    ]);
    userAId = userA.id; userBId = userB.id;
    await prisma.userDepartment.createMany({ data: [{ userId: userAId, departmentId: departmentAId, isPrimary: true }, { userId: userBId, departmentId: departmentBId, isPrimary: true }] });
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); await app.init();
    tokenA = (await request(app.getHttpServer()).post('/auth/login').send({ email: userA.email, password: 'Password123!' }).expect(201)).body.accessToken;
    tokenB = (await request(app.getHttpServer()).post('/auth/login').send({ email: userB.email, password: 'Password123!' }).expect(201)).body.accessToken;
  });

  it('keeps organization admins inside their own tenant boundary', async () => {
    const accessA = await request(app.getHttpServer()).get('/access/me').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(accessA.body.organizationId).toBe(orgAId);
    expect(accessA.body.departmentIds).toEqual([departmentAId]);

    const departmentsA = await request(app.getHttpServer()).get('/departments').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(departmentsA.body.map((department: { id: string }) => department.id)).toEqual([departmentAId]);
    await request(app.getHttpServer()).get(`/departments/${departmentBId}`).set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer()).get(`/departments/${departmentAId}`).set('Authorization', `Bearer ${tokenB}`).expect(403);
  });

  it('does not allow grants to cross organization boundaries', async () => {
    await request(app.getHttpServer()).post('/access/grants').set('Authorization', `Bearer ${tokenA}`).send({ userId: userBId, permission: 'finance.read' }).expect(404);
    const grant = await request(app.getHttpServer()).post('/access/grants').set('Authorization', `Bearer ${tokenA}`).send({ userId: userAId, permission: 'finance.read', departmentId: departmentAId }).expect(201);
    expect(grant.body.organizationId).toBe(orgAId);
    const grantsA = await request(app.getHttpServer()).get('/access/grants').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(grantsA.body).toHaveLength(1);
    const accessAfterGrant = await request(app.getHttpServer()).get('/access/me').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(accessAfterGrant.body.permissions).toEqual([{ permission: 'finance.read', departmentId: departmentAId }]);
    await request(app.getHttpServer()).get('/access/grants').set('Authorization', `Bearer ${tokenB}`).expect(200).then((response) => expect(response.body).toHaveLength(0));
  });

  it('supports organization profile updates and invitation acceptance', async () => {
    const profile = await request(app.getHttpServer()).get('/access/organization').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(profile.body.id).toBe(orgAId);
    const updated = await request(app.getHttpServer()).post('/access/organization').set('Authorization', `Bearer ${tokenA}`).send({ name: `Tenant A Updated ${suffix}`, defaultCurrency: 'EUR', fiscalYearStartMonth: 4 }).expect(201);
    expect(updated.body.name).toBe(`Tenant A Updated ${suffix}`);
    expect(updated.body.defaultCurrency).toBe('EUR');
    const invitation = await request(app.getHttpServer()).post('/access/invitations').set('Authorization', `Bearer ${tokenA}`).send({ email: `invited-${suffix}@example.test`, role: 'MANAGER', expiresInDays: 5 }).expect(201);
    expect(invitation.body.token).toBeDefined();
    expect((await request(app.getHttpServer()).get('/access/invitations').set('Authorization', `Bearer ${tokenA}`).expect(200)).body).toHaveLength(1);
    const accepted = await request(app.getHttpServer()).post(`/access/invitations/${invitation.body.token}/accept`).send({ firstName: 'Invited', lastName: 'Operator', password: 'Password123!' }).expect(201);
    invitedUserId = accepted.body.userId;
    expect(accepted.body.organizationId).toBe(orgAId);
    await request(app.getHttpServer()).post('/auth/login').send({ email: `invited-${suffix}@example.test`, password: 'Password123!' }).expect(201);
  });

  afterAll(async () => {
    await prisma.accessGrant.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.invitation.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    if (invitedUserId) await prisma.user.delete({ where: { id: invitedUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentAId, departmentBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await app.close(); await prisma.$disconnect();
  });
});
