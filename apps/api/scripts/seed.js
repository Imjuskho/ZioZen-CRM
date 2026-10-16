import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const password = 'seed-password-change-me';
  const passwordHash = await bcrypt.hash(password, 12);
  const organization = await prisma.organization.upsert({
    where: { slug: 'ziozen-default' },
    update: { name: 'ZioZen Default Organization' },
    create: { name: 'ZioZen Default Organization', slug: 'ziozen-default' },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ziozen.test' },
    update: { role: 'ADMIN', active: true, passwordHash, organizationId: organization.id },
    create: {
      email: 'admin@ziozen.test',
      passwordHash,
      firstName: 'Zio',
      lastName: 'Zen',
      role: 'ADMIN',
      active: true,
      organizationId: organization.id,
    },
  });

  const department = await prisma.department.upsert({
    where: { slug: 'studio' },
    update: { organizationId: organization.id },
    create: { name: 'ZioZen Studio', slug: 'studio', description: 'Initial department', organizationId: organization.id },
  });

  await prisma.userDepartment.upsert({
    where: { userId_departmentId: { userId: admin.id, departmentId: department.id } },
    update: { isPrimary: true },
    create: { userId: admin.id, departmentId: department.id, isPrimary: true },
  });

  console.log(`Seeded ${admin.email} in ${department.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
