import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';
import { ProjectsService } from './../src/projects/projects.service.js';

describe('Department isolation', () => {
  let moduleRef: TestingModule;
  let projectsService: ProjectsService;
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const departmentAId = `dept-a-${suffix}`;
  const departmentBId = `dept-b-${suffix}`;
  const userAId = `user-a-${suffix}`;
  const userBId = `user-b-${suffix}`;

  beforeAll(async () => {
    await prisma.department.createMany({
      data: [
        { id: departmentAId, name: `Dept A ${suffix}`, slug: `dept-a-${suffix}` },
        { id: departmentBId, name: `Dept B ${suffix}`, slug: `dept-b-${suffix}` },
      ],
    });

    await prisma.user.createMany({
      data: [
        { id: userAId, email: `a-${suffix}@test.local`, passwordHash: 'hash', firstName: 'A', lastName: 'User', role: 'MEMBER' },
        { id: userBId, email: `b-${suffix}@test.local`, passwordHash: 'hash', firstName: 'B', lastName: 'User', role: 'MEMBER' },
      ],
    });

    await prisma.userDepartment.createMany({
      data: [
        { userId: userAId, departmentId: departmentAId, isPrimary: true },
        { userId: userBId, departmentId: departmentBId, isPrimary: true },
      ],
    });

    await prisma.project.create({
      data: { name: `Project A ${suffix}`, departmentId: departmentAId, ownerId: userAId },
    });

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    projectsService = moduleRef.get(ProjectsService);
  });

  it('returns only the assigned department for a member', async () => {
    const visible = await projectsService.findAll(userAId);
    expect(visible).toHaveLength(1);
  });

  it('hides other departments from a member', async () => {
    const visible = await projectsService.findAll(userBId);
    expect(visible).toHaveLength(0);
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { departmentId: { in: [departmentAId, departmentBId] } } });
    await prisma.userDepartment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.department.deleteMany({ where: { id: { in: [departmentAId, departmentBId] } } });
    await moduleRef.close();
    await prisma.$disconnect();
  });
});
