import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const dates = await prisma.scheduleDate.findMany();
  let updatedCount = 0;

  for (const d of dates) {
    let changed = false;
    const data = d.data as Record<string, any>;
    
    for (const colId in data) {
      const cell = data[colId];
      if (cell.dayType === 'выходной' || cell.text === 'Выходной') {
        if (cell.cars?.length > 0 || cell.staff?.length > 0 || cell.color === '#cccccc' || cell.color === '') {
          cell.cars = [];
          cell.staff = [];
          cell.dayType = 'выходной';
          cell.text = 'Выходной';
          cell.color = ''; // Cleared so it maps to darkest empty color
          changed = true;
        }
      }
    }
    
    if (changed) {
      await prisma.scheduleDate.update({ where: { id: d.id }, data: { data } });
      updatedCount++;
    }
  }
  
  console.log(`Cleaned weekends in DB. Updated ${updatedCount} days.`);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
