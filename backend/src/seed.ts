import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create an admin user
  const adminPassword = 'admin'; // Change in production!
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  const admin = await prisma.user.upsert({
    where: { accessToken: 'admin_token' }, // Just a dummy unique field usage
    update: {},
    create: {
      name: 'Admin',
      role: 'ADMIN',
      passwordHash,
    },
  });

  // Create a staff user with an access token
  const staffToken = crypto.randomBytes(16).toString('hex');
  const staff = await prisma.user.create({
    data: {
      name: 'Ivan Ivanov',
      role: 'STAFF',
      accessToken: staffToken,
    },
  });

  // Create initial project columns
  const p1 = await prisma.projectColumn.create({
    data: { name: 'СВОИ Туманова', order: 1 }
  });
  const p2 = await prisma.projectColumn.create({
    data: { name: 'Дом с ментами', order: 2 }
  });
  const p3 = await prisma.projectColumn.create({
    data: { name: 'Гараж', order: 3 }
  });

  // Create some initial schedule data
  const today = new Date().toISOString().split('T')[0];
  await prisma.scheduleDate.upsert({
    where: { date: today },
    update: {},
    create: {
      date: today,
      data: {
        [p1.id]: { text: 'Ivan Ivanov 🚘', color: '#ffcc00' },
        [p2.id]: { text: 'Petr Petrov 🚚', color: '#66ccff' },
      }
    }
  });

  console.log('Seed completed successfully.');
  console.log(`Admin login: Admin / admin`);
  console.log(`Staff access link: http://localhost:5173/my-calendar?token=${staffToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
