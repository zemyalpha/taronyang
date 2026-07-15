import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, getDb, createUser } from '../database';
import { config } from '../config';
import { authMiddleware, adminMiddleware } from '../routes/auth';

function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
  });

  app.get('/api/health/detail', authMiddleware, adminMiddleware, (_req, res) => {
    const db = getDb();
    let userCount = 0;
    let readingCount = 0;
    try {
      userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
      readingCount = (db.prepare('SELECT COUNT(*) as c FROM readings').get() as { c: number }).c;
    } catch {
      // ignore
    }

    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'taronyang',
      version: '0.1.0',
      uptime: Math.floor(uptime),
      uptimeHuman: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h`,
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      },
      database: {
        users: userCount,
        readings: readingCount,
      },
    });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      error: '서버 내부 오류가 발생했습니다.',
      ...(config.nodeEnv !== 'production' && { detail: err.message }),
    });
  });

  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

describe('GET /api/health', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('taronyang');
    expect(res.body.version).toBe('0.1.0');
  });
});

describe('GET /api/health/detail', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/health/detail');
    expect(res.status).toBe(401);
  });

  it('should return 403 with non-admin user', async () => {
    const user = createUser('healthuser@test.com', 'password123');
    const token = makeToken(user!.id);

    const res = await request(app)
      .get('/api/health/detail')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return detailed health info for admin user', async () => {
    const admin = createUser('admin-test@taronyang.com', 'password123');
    const token = makeToken(admin!.id);

    const res = await request(app)
      .get('/api/health/detail')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('taronyang');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.uptimeHuman).toBeDefined();
    expect(res.body.memory).toBeDefined();
    expect(res.body.memory.rss).toMatch(/MB$/);
    expect(res.body.memory.heapUsed).toMatch(/MB$/);
    expect(res.body.database).toBeDefined();
    expect(typeof res.body.database.users).toBe('number');
    expect(typeof res.body.database.readings).toBe('number');
  });

  it('should count users and readings in database', async () => {
    createUser('counter1@test.com', 'password123');
    createUser('counter2@test.com', 'password123');

    const admin = createUser('admin-test@taronyang.com', 'password123');
    const token = makeToken(admin!.id);

    const res = await request(app)
      .get('/api/health/detail')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.database.users).toBeGreaterThanOrEqual(3);
  });
});
