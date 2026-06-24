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
      
      // Fix yellow pavilion cells
      if (cell.color === '#ffe599' || cell.color === '#ffd966') {
        cell.dayType = 'павильон';
        cell.color = ''; // clear explicit color to use dynamic theme color
        changed = true;
      }
      
      // Fix legacy СТОП cells
      if (cell.text === 'СТОП' || cell.color === '#e06666' || cell.color === '#cc0000') {
        cell.dayType = 'стоп';
        cell.text = 'СТОП';
        cell.color = ''; // clear explicit color to use dynamic theme color
        cell.staff = [];
        cell.cars = [];
        cell.options = [];
        changed = true;
      }
    }
    
    if (changed) {
      await prisma.scheduleDate.update({ where: { id: d.id }, data: { data } });
      updatedCount++;
    }
  }
  
  console.log(`Migrated legacy colors to dynamic dayTypes. Updated ${updatedCount} days.`);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
