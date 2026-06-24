import fs from 'fs';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx importHtml.ts <path-to-html>');
    process.exit(1);
  }

  console.log(`Parsing ${filePath}...`);
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  // Parse styles for colors
  const styleText = $('style').text();
  const colorMap: Record<string, string> = {};
  const styleRegex = /\.ritz \.waffle \.(s\d+)\{.*?background-color:(#[0-9a-fA-F]{6});.*?\}/g;
  let match;
  while ((match = styleRegex.exec(styleText)) !== null) {
    colorMap[match[1]] = match[2];
  }

  const rows = $('table.waffle tbody tr');
  
  let columns: { id: string, name: string, index: number }[] = [];
  let isParsingData = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tds = $(row).find('td');
    
    // Find Header Row
    if (!isParsingData) {
      let isHeader = false;
      tds.each((idx, td) => {
        const text = $(td).text().trim();
        if (text === 'Дата') {
          isHeader = true;
        }
      });

      if (isHeader) {
        console.log('Found header row, creating columns...');
        await prisma.projectColumn.deleteMany();
        
        let order = 0;
        tds.each((idx, el) => {
          const text = $(el).text().trim();
          if (text && text !== 'Дата' && !$(el).hasClass('freezebar-cell')) {
            columns.push({ id: '', name: text, index: idx });
          }
        });

        for (const col of columns) {
          const dbCol = await prisma.projectColumn.create({
            data: { name: col.name, order: order++ }
          });
          col.id = dbCol.id;
        }
        
        isParsingData = true;
        await prisma.scheduleDate.deleteMany();
        continue;
      }
    }

    if (isParsingData) {
      // Find date cell (usually the first td that is not freezebar)
      let dateTdIdx = -1;
      tds.each((idx, el) => {
        if ($(el).hasClass('freezebar-cell')) return;
        if (dateTdIdx === -1) dateTdIdx = idx;
      });

      const dateTd = tds.eq(dateTdIdx);
      let dateText = dateTd.text().trim();
      
      // Stop parsing if we hit empty date row consecutively maybe? We'll just continue.
      if (!dateText || !/^\d{2}\.\d{2}$/.test(dateText)) continue;
      
      const [dd, mm] = dateText.split('.');
      const isoDate = `2026-${mm}-${dd}`;

      const dataObj: Record<string, { text: string, color: string }> = {};

      for (const col of columns) {
        const td = tds.eq(col.index);
        let cellText = td.text().trim().replace(/\s+/g, ' ');
        
        let color = '';
        const classAttr = td.attr('class') || '';
        const classes = classAttr.split(' ');
        for (const cls of classes) {
          if (colorMap[cls]) {
            color = colorMap[cls];
            break;
          }
        }

        if (color.toLowerCase() === '#ffffff') color = '';

        if (cellText || color) {
          dataObj[col.id] = { text: cellText, color: color };
        }
      }

      await prisma.scheduleDate.upsert({
        where: { date: isoDate },
        update: { data: dataObj },
        create: { date: isoDate, data: dataObj },
      });
      console.log(`Imported ${isoDate}`);
    }
  }

  console.log('Import completed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
