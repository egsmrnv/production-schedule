import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Seeding cars...');
  const cars = [
    { label: '⬛️ Белый крафтер', color: '#cccccc' },
    { label: '⚫️ Белый спринтер', color: '#cccccc' },
    { label: '🟢 Зеленый спринтер', color: '#b6d7a8' },
    { label: '🟠 Оранжевый', color: '#fce5cd' },
  ];
  
  for (const c of cars) {
    const existing = await prisma.car.findFirst({ where: { label: c.label } });
    if (!existing) {
      await prisma.car.create({ data: c });
    }
  }

  console.log('Extracting staff from existing schedule data...');
  const dates = await prisma.scheduleDate.findMany();
  const staffSet = new Set<string>();
  const exclude = ['Выходной', 'СТОП', 'Нет', 'ОТМЕНА', 'СМЕНЫ', 'СВОИ', 'ЛИЦЕМЕРЫ', 'Фестиваль'];
  
  dates.forEach(d => {
    Object.values(d.data as any).forEach((cell: any) => {
      if (cell.text) {
        const words = cell.text.split(/[\s/(),[\]]+/);
        words.forEach((w: string) => {
          const cleanWord = w.replace(/[^\p{L}]/gu, '');
          if (
            cleanWord.length > 2 && 
            cleanWord[0] === cleanWord[0].toUpperCase() && 
            cleanWord[0] !== cleanWord[0].toLowerCase() && 
            !exclude.includes(cleanWord)
          ) {
            staffSet.add(cleanWord);
          }
        });
      }
    });
  });

  const uniqueStaff = Array.from(staffSet);
  let staffAdded = 0;
  for (const name of uniqueStaff) {
    const existing = await prisma.user.findFirst({ where: { name } });
    if (!existing) {
      await prisma.user.create({ data: { name, role: 'STAFF' } });
      staffAdded++;
    }
  }
  
  console.log(`Successfully added cars and ${staffAdded} staff members.`);
}

run()
  .catch(e => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
