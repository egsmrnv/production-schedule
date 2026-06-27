import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting migration to UUIDs...');

  const users = await prisma.user.findMany();
  const cars = await prisma.car.findMany();

  const userMap = new Map<string, string>();
  users.forEach(u => userMap.set(u.name, u.id));

  const carMap = new Map<string, string>();
  cars.forEach(c => carMap.set(c.label, c.id));

  const dates = await prisma.scheduleDate.findMany();
  let updatedCount = 0;

  for (const d of dates) {
    let changed = false;
    const data = d.data as Record<string, any>;

    for (const colId in data) {
      const cell = data[colId];
      if (!cell) continue;

      if (cell.staff && Array.isArray(cell.staff)) {
        const newStaff = cell.staff.map((s: string) => {
          if (userMap.has(s)) {
            changed = true;
            return userMap.get(s)!;
          }
          return s; // Keep as is if not found (might already be UUID or unknown)
        });
        cell.staff = newStaff;
      }

      if (cell.cars && Array.isArray(cell.cars)) {
        const newCars = cell.cars.map((c: string) => {
          if (carMap.has(c)) {
            changed = true;
            return carMap.get(c)!;
          }
          return c; // Keep as is
        });
        cell.cars = newCars;
      }
    }

    if (changed) {
      await prisma.scheduleDate.update({
        where: { id: d.id },
        data: { data }
      });
      updatedCount++;
    }
  }

  console.log(`Migration completed! Updated ${updatedCount} schedule dates.`);
}

migrate()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
