/**
 * Usage: npm run create-admin <email> <password>
 * Example: npm run create-admin admin@hoje.city MinhaS3nha!
 */
import '../src/config'; // validate env
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage: npm run create-admin <email> <password>');
    process.exit(1);
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Invalid email address');
    process.exit(1);
  }

  // Password strength
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const existingAdmin = await prisma.admin.findUnique({ where: { email } });
  if (existingAdmin) {
    console.error(`Admin with email ${email} already exists`);
    process.exit(1);
  }

  // bcrypt cost >= 12 (A02)
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(`✅ Admin created: ${admin.email} (${admin.role})`);
  console.log(`   ID: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
