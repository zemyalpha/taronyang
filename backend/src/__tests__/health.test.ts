import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, getDb, createUser, User } from '../database';
import { config } from '../config';
import { healthRouter } from '../routes/health';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

function createAdminUser(email: string, password: string): User | null {
  const user = createUser(email, password);
  if (user) {
    getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
    user.is_admin = 1;
  }
  return user;
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
    const admin = createAdminUser('admin-test@taronyang.com', 'password123');
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

    const admin = createAdminUser('admin-test@taronyang.com', 'password123');
    const token = makeToken(admin!.id);

    const res = await request(app)
      .get('/api/health/detail')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.database.users).toBeGreaterThanOrEqual(3);
  });
});
