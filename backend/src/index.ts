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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:2626';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing.');
}

app.use(cors({ origin: CORS_ORIGIN }));
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

app.put('/api/columns/reorder', requireAdmin, async (req, res) => {
  try {
    const columns: { id: string, order: number }[] = req.body;
    if (!Array.isArray(columns)) {
      return res.status(400).json({ error: 'Expected array of columns' });
    }
    
    const updates = columns.map(c => 
      prisma.projectColumn.update({
        where: { id: c.id },
        data: { order: c.order }
      })
    );
    
    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/columns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.projectColumn.delete({ where: { id } });
    
    // Cascade delete in JSON using transaction
    const dates = await prisma.scheduleDate.findMany();
    const updates = [];
    for (const d of dates) {
      const data = d.data as Record<string, any>;
      if (data[id]) {
        delete data[id];
        updates.push(
          prisma.scheduleDate.update({ where: { id: d.id }, data: { data } })
        );
      }
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Admin Entity Management ---
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  const projects = await prisma.project.findMany();
  res.json(projects);
});

app.post('/api/admin/projects', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  try {
    const project = await prisma.project.create({ data: { name, color: color || '#0a84ff' } });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  try {
    const project = await prisma.project.update({ where: { id }, data: { name, color } });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    // Note: We intentionally do not cascade delete project assignments from scheduleData
    // to allow historical data to keep using the old name/color fallback if the project is deleted.
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/staff', requireAdmin, async (req, res) => {
  const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
  res.json(staff);
});

app.post('/api/admin/staff', requireAdmin, async (req, res) => {
  const { name } = req.body;
  try {
    const staff = await prisma.user.create({ data: { name, role: 'STAFF' } });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/staff/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff) return res.status(404).json({ error: 'Not found' });
    
    await prisma.user.delete({ where: { id } });
    
    // Cascade delete in JSON using transaction
    const dates = await prisma.scheduleDate.findMany();
    const updates = [];
    for (const d of dates) {
      let changed = false;
      const data = d.data as Record<string, any>;
      for (const colId in data) {
        if (data[colId].staff && data[colId].staff.includes(staff.name)) {
          data[colId].staff = data[colId].staff.filter((s: string) => s !== staff.name);
          data[colId].text = data[colId].staff.join(' '); // fallback text update
          changed = true;
        }
      }
      if (changed) {
        updates.push(
          prisma.scheduleDate.update({ where: { id: d.id }, data: { data } })
        );
      }
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }
    res.json({ success: true });
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/cars/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const car = await prisma.car.findUnique({ where: { id } });
    if (!car) return res.status(404).json({ error: 'Not found' });
    
    await prisma.car.delete({ where: { id } });
    
    // Cascade delete in JSON using transaction
    const dates = await prisma.scheduleDate.findMany();
    const updates = [];
    for (const d of dates) {
      let changed = false;
      const data = d.data as Record<string, any>;
      for (const colId in data) {
        if (data[colId].cars && data[colId].cars.includes(car.label)) {
          data[colId].cars = data[colId].cars.filter((c: string) => c !== car.label);
          changed = true;
        }
      }
      if (changed) {
        updates.push(
          prisma.scheduleDate.update({ where: { id: d.id }, data: { data } })
        );
      }
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Settings Endpoints ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await prisma.studioSetting.findMany();
    const map = settings.reduce((acc, s) => ({...acc, [s.key]: s.value}), {});
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    for (const [key, value] of Object.entries(data)) {
      await prisma.studioSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
    res.json({ success: true });
  } catch (error) {
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
    const filteredDates = [];
    const staffName = staffUser.name;

    for (const d of dates) {
      const rowData = d.data as Record<string, any>;
      const filteredData: Record<string, any> = {};
      let hasData = false;
      
      for (const colId in rowData) {
        const cell = rowData[colId];
        if (!cell) continue;

        // Fast path: if staff array exists, check it directly
        // Real requirement: "сотрудник видит только СВОЕ расписание"
        if (cell.staff?.includes(staffName)) {
          filteredData[colId] = cell;
          hasData = true;
        } else if (cell.text?.includes(staffName)) {
          // Fallback to text search
          filteredData[colId] = cell;
          hasData = true;
        }
      }

      if (hasData) {
        filteredDates.push({ ...d, data: filteredData });
      }
    }

    res.json({ staffName: staffUser.name, columns, dates: filteredDates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
