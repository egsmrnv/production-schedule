import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.scheduleDate.deleteMany();
  await prisma.projectColumn.deleteMany();
  await prisma.car.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create an admin user
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      role: 'ADMIN',
      passwordHash,
    },
  });

  // Create a staff user with an access token
  const staffToken = crypto.randomBytes(16).toString('hex');
  const staff = await prisma.user.create({
    data: {
      name: 'Иван Иванов',
      role: 'STAFF',
      accessToken: staffToken,
    },
  });

  // Additional staff
  const staffNames = ['Петр Петров', 'Сергей Сергеев', 'Анна Смирнова', 'Елена Попова', 'Алексей Волков', 'Мария Соколова', 'Дмитрий Лебедев', 'Ольга Козлова', 'Михаил Новиков', 'Екатерина Морозова'];
  for (const name of staffNames) {
    await prisma.user.create({ data: { name, role: 'STAFF' } });
  }
  const allStaff = ['Иван Иванов', ...staffNames];

  // Create Equipment
  const carsData = [
    { label: '🚗 Газель', color: '#ffcc00' },
    { label: '🚚 Фургон', color: '#66ccff' },
    { label: '🚙 Джип', color: '#8e7cc3' },
    { label: '🚐 Минивэн', color: '#93c47d' }
  ];
  const cars = [];
  for (const c of carsData) {
    cars.push(await prisma.car.create({ data: c }));
  }

  // Create Projects
  const projectsData = [
    { name: 'Кино "Легенда"', color: '#e06666' },
    { name: 'Сериал "Городские"', color: '#f6b26b' },
    { name: 'Реклама "Супер-чай"', color: '#ffd966' },
    { name: 'Клип "Звезды"', color: '#76a5af' },
    { name: 'Док. фильм "Природа"', color: '#c27ba0' }
  ];
  const projects = [];
  for (const p of projectsData) {
    projects.push(await prisma.project.create({ data: p }));
  }

  // Create Project Columns
  const colsData = ['Основная съемочная', 'Вторая группа', 'Подготовка', 'Постпродакшн'];
  const columns = [];
  for (let i = 0; i < colsData.length; i++) {
    columns.push(await prisma.projectColumn.create({ data: { name: colsData[i]!, order: i } }));
  }

  // Generate Schedule Dates (dense data)
  const today = new Date();
  const dayTypes = ['натура', 'павильон', 'склад', 'переезд'];
  
  for (let i = -5; i <= 20; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().substring(0, 10);
    
    const data: Record<string, any> = {};
    
    // Fill columns
    for (let c = 0; c < columns.length; c++) {
      const colId = columns[c]!.id;
      
      // Column 0: Project 0, running from i=-5 to i=10
      if (c === 0) {
        if (i === -5) {
          data[colId] = { cellType: 'project_start', projectId: projects[0]!.id, text: projects[0]!.name, color: projects[0]!.color, comment: 'Начало съемок' };
        } else if (i === 10) {
          data[colId] = { cellType: 'stop', text: 'СТОП' };
        } else if (i > -5 && i < 10) {
          if (i % 7 === 0 || i % 7 === 1) { // Weekend
            data[colId] = { cellType: 'day_off', dayType: 'выходной', text: 'Выходной' };
          } else {
            const shiftStaff = [allStaff[Math.abs(i + c) % allStaff.length]!, allStaff[Math.abs(i + c + 1) % allStaff.length]!];
            const shiftCars = [carsData[Math.abs(i) % carsData.length]!.label];
            const dType = dayTypes[Math.abs(i) % dayTypes.length]!;
            let cellType = 'shift';
            let text = shiftStaff.join(' ');
            if (dType === 'склад') {
              cellType = 'warehouse';
            } else if (dType === 'переезд') {
              cellType = 'relocation';
            } else {
              text += ` [${dType}]`;
            }

            const carEmojis = shiftCars.map(c => c.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\S+)/u)?.[1] || '').join('');
            if (carEmojis) text = carEmojis + ' ' + text;

            data[colId] = { cellType, dayType: cellType === 'shift' ? dType : undefined, staff: shiftStaff, cars: shiftCars, text, color: carsData[Math.abs(i) % carsData.length]!.color };
          }
        }
      }
      
      // Column 1: Project 1, running from i=0 to i=15
      if (c === 1) {
        if (i === 0) {
          data[colId] = { cellType: 'project_start', projectId: projects[1]!.id, text: projects[1]!.name, color: projects[1]!.color };
        } else if (i === 15) {
          data[colId] = { cellType: 'stop', text: 'СТОП' };
        } else if (i > 0 && i < 15) {
          if (i % 6 === 0) {
            data[colId] = { cellType: 'sleep_off', text: 'Отсыпной' };
          } else {
            const shiftStaff = [allStaff[Math.abs(i + 3) % allStaff.length]!];
            const shiftCars = [carsData[Math.abs(i+1) % carsData.length]!.label];
            const dType = dayTypes[Math.abs(i+1) % dayTypes.length]!;
            let cellType = 'shift';
            let text = shiftStaff.join(' ');
            if (dType === 'склад') { cellType = 'warehouse'; text += ' [погрузка]'; }
            else if (dType === 'переезд') { cellType = 'relocation'; text += ' [погрузка]'; }
            else { text += ` [${dType}, погрузка]`; }

            const carEmojis = shiftCars.map(c => c.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\S+)/u)?.[1] || '').join('');
            if (carEmojis) text = carEmojis + ' ' + text;

            data[colId] = { cellType, dayType: cellType === 'shift' ? dType : undefined, staff: shiftStaff, cars: shiftCars, text, color: carsData[Math.abs(i+1) % carsData.length]!.color, options: ['погрузка'] };
          }
        }
      }
      
      // Column 2: Project 2 starts later
      if (c === 2) {
        if (i === 5) {
          data[colId] = { cellType: 'project_start', projectId: projects[2]!.id, text: projects[2]!.name, color: projects[2]!.color };
        } else if (i > 5 && i <= 20) {
          const shiftStaff = [allStaff[Math.abs(i + 5) % allStaff.length]!];
          data[colId] = { cellType: 'warehouse', staff: shiftStaff, text: shiftStaff.join(' ') };
        }
      }
    }
    
    if (Object.keys(data).length > 0) {
      await prisma.scheduleDate.upsert({
        where: { date: dateStr },
        update: { data },
        create: { date: dateStr, data }
      });
    }
  }

  console.log('Seed completed successfully.');
  console.log(`Admin login: Admin / ${adminPassword}`);
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
