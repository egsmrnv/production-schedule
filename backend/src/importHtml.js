"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const cheerio = __importStar(require("cheerio"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: tsx importHtml.ts <path-to-html>');
        process.exit(1);
    }
    console.log(`Parsing ${filePath}...`);
    const html = fs_1.default.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    // Parse styles for colors
    const styleText = $('style').text();
    const colorMap = {};
    const styleRegex = /\.ritz \.waffle \.(s\d+)\{.*?background-color:(#[0-9a-fA-F]{6});.*?\}/g;
    let match;
    while ((match = styleRegex.exec(styleText)) !== null) {
        colorMap[match[1]] = match[2];
    }
    const rows = $('table.waffle tbody tr');
    let columns = [];
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
                if ($(el).hasClass('freezebar-cell'))
                    return;
                if (dateTdIdx === -1)
                    dateTdIdx = idx;
            });
            const dateTd = tds.eq(dateTdIdx);
            let dateText = dateTd.text().trim();
            // Stop parsing if we hit empty date row consecutively maybe? We'll just continue.
            if (!dateText || !/^\d{2}\.\d{2}$/.test(dateText))
                continue;
            const [dd, mm] = dateText.split('.');
            const isoDate = `2026-${mm}-${dd}`;
            const dataObj = {};
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
                if (color.toLowerCase() === '#ffffff')
                    color = '';
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
//# sourceMappingURL=importHtml.js.map