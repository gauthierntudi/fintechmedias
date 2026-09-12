const { PrismaClient, AdminRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const name = process.env.ADMIN_NAME ?? 'Administrateur';
  const previousEmail = (process.env.PREVIOUS_ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase();

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont requis');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    await prisma.adminUser.update({
      where: { email },
      data: {
        passwordHash,
        name,
        isActive: true,
        role:
          existing.role === AdminRole.SUPERADMIN
            ? existing.role
            : AdminRole.SUPERADMIN,
      },
    });
    console.log(`Admin mis à jour: ${email}`);
  } else {
    await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
        role: AdminRole.SUPERADMIN,
      },
    });
    console.log(`Admin créé: ${email}`);
  }

  if (previousEmail && previousEmail !== email) {
    const previous = await prisma.adminUser.findUnique({
      where: { email: previousEmail },
    });
    if (previous) {
      await prisma.adminUser.update({
        where: { email: previousEmail },
        data: { isActive: false },
      });
      console.log(`Ancien admin désactivé: ${previousEmail}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
