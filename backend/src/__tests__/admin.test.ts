import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, getDb, createUser, User } from '../database';
import { authMiddleware, adminMiddleware } from '../routes/auth';
import { adminRouter } from '../routes/admin';
import { readingsRouter, saveReading } from '../routes/readings';
import { config } from '../config';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/readings', readingsRouter);
  app.use('/admin', adminRouter);
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

describe('admin routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM daily_horoscopes').run();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  // --- AdminMiddleware ---

  describe('AdminMiddleware', () => {
    function createMiddlewareApp(): Express {
      const mw = express();
      mw.use(express.json());
      mw.get(
        '/admin-only',
        authMiddleware,
        adminMiddleware,
        (_req, res) => res.json({ ok: true })
      );
      return mw;
    }

    it('rejects unauthenticated request (401)', async () => {
      const mwApp = createMiddlewareApp();
      const res = await request(mwApp).get('/admin-only');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin user (403)', async () => {
      const mwApp = createMiddlewareApp();
      const user = createUser('regular-user@test.com', 'pass123');
      const res = await request(mwApp)
        .get('/admin-only')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(403);
    });
  });

  // --- GET /admin/stats ---

  describe('GET /admin/stats', () => {
    it('returns dashboard stats for admin', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      createUser('normal1@test.com', 'pass123');
      createUser('normal2@test.com', 'pass123');

      const res = await request(app)
        .get('/admin/stats')
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.total_users).toBe(3);
      expect(res.body.premium_users).toBe(0);
      expect(res.body.free_users).toBe(3);
      expect(res.body.total_readings).toBe(0);
    });
  });

  // --- GET /admin/users ---

  describe('GET /admin/users', () => {
    it('returns paginated user list', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      createUser('user1@test.com', 'pass123');
      createUser('user2@test.com', 'pass123');

      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users).toHaveLength(3);
    });

    it('respects limit param', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      for (let i = 0; i < 5; i++) {
        createUser(`limit${i}@test.com`, 'pass123');
      }

      const res = await request(app)
        .get('/admin/users?limit=2')
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.total).toBe(6);
      expect(res.body.pages).toBe(3);
    });
  });

  // --- GET /admin/readings ---

  describe('GET /admin/readings', () => {
    it('returns paginated readings', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      const author = createUser('author@test.com', 'pass123');
      saveReading(author!.id, 'love', '질문1', [], '해석1');
      saveReading(author!.id, 'career', '질문2', [], '해석2');

      const res = await request(app)
        .get('/admin/readings')
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(Array.isArray(res.body.readings)).toBe(true);
      expect(res.body.readings).toHaveLength(2);
    });
  });

  // --- DELETE /admin/users/:id ---

  describe('DELETE /admin/users/:id', () => {
    it('cascades delete user and related data', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      const target = createUser('delete-me@test.com', 'pass123');
      saveReading(target!.id, 'love', '질문', [], '해석');

      const res = await request(app)
        .delete(`/admin/users/${target!.id}`)
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const db = getDb();
      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(target!.id);
      const readingRow = db.prepare('SELECT * FROM readings WHERE user_id = ?').get(target!.id);
      expect(userRow).toBeUndefined();
      expect(readingRow).toBeUndefined();
    });
  });
});
