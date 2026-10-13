const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ziozen.test' },
    update: { role: 'ADMIN', active: true },
    create: {
      email: 'admin@ziozen.test',
      passwordHash: 'seed-password-change-me',
      firstName: 'Zio',
      lastName: 'Zen',
      role: 'ADMIN',
      active: true,
    },
  });

  const department = await prisma.department.upsert({
    where: { slug: 'studio' },
    update: {},
    create: { name: 'ZioZen Studio', slug: 'studio', description: 'Initial department' },
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
