import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

app.use(cors());
app.use(express.json());

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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware for Admin access
const requireAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'ADMIN') throw new Error('Not admin');
    req.user = decoded;
    next();
  } catch (err) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
      const filteredData: Record<string, any> = {};
      const rowData = d.data as Record<string, { text: string, color: string }>;
      
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
