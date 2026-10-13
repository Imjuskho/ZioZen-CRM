import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('RBAC', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects department creation for a non-admin', async () => {
    const suffix = Date.now().toString();
    const email = `member-${suffix}@test.local`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, firstName: 'Member', lastName: 'User' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const token = login.body.accessToken;
    await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Restricted ${suffix}`, slug: `restricted-${suffix}` })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
