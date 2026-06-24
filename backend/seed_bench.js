const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: { name: 'John Doe', role: 'STAFF', accessToken: 'token-john' }
  });

  const columns = [];
  for (let i=0; i<10; i++) {
    const col = await prisma.projectColumn.create({
      data: { name: `Col ${i}`, order: i }
    });
    columns.push(col.id);
  }

  const dataObj = {};
  for (const colId of columns) {
    dataObj[colId] = {
      text: "Some long text with John Doe in the middle of it and some more text to make it realistic.",
      staff: ["John Doe", "Jane Doe"],
      color: "#ff0000"
    };
  }

  for (let i=0; i<100; i++) {
    await prisma.scheduleDate.create({
      data: {
        date: `2023-01-${i.toString().padStart(2, '0')}`,
        data: dataObj
      }
    });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
