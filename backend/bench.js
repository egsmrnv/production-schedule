const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runBench() {
  const staffUser = await prisma.user.findFirst({ where: { name: 'John Doe' } });

  const dates = await prisma.scheduleDate.findMany();

  let start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const filteredDates = dates.map(d => {
      const filteredData = {};
      const rowData = d.data;

      for (const [colId, cell] of Object.entries(rowData)) {
        if (cell && cell.text && cell.text.includes(staffUser.name)) {
          filteredData[colId] = cell;
        }
      }
      return { ...d, data: filteredData };
    }).filter(d => Object.keys(d.data).length > 0);
  }
  let end = performance.now();
  console.log(`Baseline (map + filter + Object.entries + text includes): ${(end - start).toFixed(2)} ms`);

  start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const filteredDates = [];
    const staffName = staffUser.name;
    for (const d of dates) {
      const rowData = d.data;
      const filteredData = {};
      let hasData = false;

      for (const colId in rowData) {
        const cell = rowData[colId];
        if (!cell) continue;

        // Fast path: if staff array exists, check it directly
        if (cell.staff) {
          if (cell.staff.includes(staffName)) {
            filteredData[colId] = cell;
            hasData = true;
          }
        } else if (cell.text && cell.text.includes(staffName)) {
          // Fallback to text search if no staff array
          filteredData[colId] = cell;
          hasData = true;
        }
      }

      if (hasData) {
        filteredDates.push({ ...d, data: filteredData });
      }
    }
  }
  end = performance.now();
  console.log(`Optimized (for...of + in + staff-array fastpath): ${(end - start).toFixed(2)} ms`);
}

runBench().catch(console.error).finally(() => prisma.$disconnect());
