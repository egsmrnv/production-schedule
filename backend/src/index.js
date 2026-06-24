"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- Admin Authentication ---
app.post('/api/auth/login', async (req, res) => {
    const { name, password } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: { name, role: 'ADMIN' },
        });
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
// Middleware for Admin access
const requireAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.role !== 'ADMIN')
            throw new Error('Not admin');
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
// --- Schedule Endpoints (Admin) ---
app.get('/api/schedule', requireAdmin, async (req, res) => {
    try {
        const columns = await prisma.projectColumn.findMany({
            orderBy: { order: 'asc' },
        });
        // Get schedule for the next 30 days around today
        // For simplicity, we just fetch all or filter by a date range
        const dates = await prisma.scheduleDate.findMany({
            orderBy: { date: 'asc' },
        });
        res.json({ columns, dates });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
app.put('/api/schedule', requireAdmin, async (req, res) => {
    const { date, data } = req.body;
    // data should be the JSON object with column data
    try {
        const updated = await prisma.scheduleDate.upsert({
            where: { date },
            update: { data },
            create: { date, data },
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
app.post('/api/columns', requireAdmin, async (req, res) => {
    const { name, order } = req.body;
    try {
        const column = await prisma.projectColumn.create({
            data: { name, order }
        });
        res.json(column);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
app.delete('/api/columns/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.projectColumn.delete({ where: { id } });
        // Cascade delete in JSON
        const dates = await prisma.scheduleDate.findMany();
        for (const d of dates) {
            const data = d.data;
            if (data[id]) {
                delete data[id];
                await prisma.scheduleDate.update({ where: { id: d.id }, data: { data } });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
// --- Admin Entity Management ---
app.get('/api/admin/staff', requireAdmin, async (req, res) => {
    const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
    res.json(staff);
});
app.post('/api/admin/staff', requireAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        const staff = await prisma.user.create({ data: { name, role: 'STAFF' } });
        res.json(staff);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.delete('/api/admin/staff/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await prisma.user.findUnique({ where: { id } });
        if (!staff)
            return res.status(404).json({ error: 'Not found' });
        await prisma.user.delete({ where: { id } });
        const dates = await prisma.scheduleDate.findMany();
        for (const d of dates) {
            let changed = false;
            const data = d.data;
            for (const colId in data) {
                if (data[colId].staff && data[colId].staff.includes(staff.name)) {
                    data[colId].staff = data[colId].staff.filter((s) => s !== staff.name);
                    data[colId].text = data[colId].staff.join(' '); // fallback text update
                    changed = true;
                }
            }
            if (changed) {
                await prisma.scheduleDate.update({ where: { id: d.id }, data: { data } });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
app.get('/api/admin/cars', requireAdmin, async (req, res) => {
    const cars = await prisma.car.findMany();
    res.json(cars);
});
app.post('/api/admin/cars', requireAdmin, async (req, res) => {
    const { label, color } = req.body;
    try {
        const car = await prisma.car.create({ data: { label, color: color || '#cccccc' } });
        res.json(car);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.delete('/api/admin/cars/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const car = await prisma.car.findUnique({ where: { id } });
        if (!car)
            return res.status(404).json({ error: 'Not found' });
        await prisma.car.delete({ where: { id } });
        const dates = await prisma.scheduleDate.findMany();
        for (const d of dates) {
            let changed = false;
            const data = d.data;
            for (const colId in data) {
                if (data[colId].cars && data[colId].cars.includes(car.label)) {
                    data[colId].cars = data[colId].cars.filter((c) => c !== car.label);
                    changed = true;
                }
            }
            if (changed) {
                await prisma.scheduleDate.update({ where: { id: d.id }, data: { data } });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
// --- Staff Endpoints ---
app.get('/api/staff/schedule', async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    try {
        const staffUser = await prisma.user.findUnique({
            where: { accessToken: token }
        });
        if (!staffUser || !staffUser.isActive) {
            return res.status(401).json({ error: 'Unauthorized or inactive user' });
        }
        const columns = await prisma.projectColumn.findMany({
            orderBy: { order: 'asc' },
        });
        const dates = await prisma.scheduleDate.findMany({
            orderBy: { date: 'asc' },
        });
        // Filter data specifically for this staff member
        // In a real app, we'd only return cells where their name is mentioned
        // Or just return the whole schedule if it's open for them.
        const filteredDates = dates.map(d => {
            const filteredData = {};
            const rowData = d.data;
            for (const [colId, cell] of Object.entries(rowData)) {
                // If cell contains staff member's name, include it
                // Or if we want them to see everything, just pass it through
                // We'll pass it through for now, but mark it. 
                // Real requirement: "сотрудник видит только СВОЕ расписание"
                if (cell && cell.text && cell.text.includes(staffUser.name)) {
                    filteredData[colId] = cell;
                }
            }
            return { ...d, data: filteredData };
        }).filter(d => Object.keys(d.data).length > 0);
        res.json({ staffName: staffUser.name, columns, dates: filteredDates });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map