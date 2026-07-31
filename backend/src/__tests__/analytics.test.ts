import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, getDb, createUser, User } from '../database';
import { analyticsRouter } from '../routes/analytics';
import { config } from '../config';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
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

describe('analytics routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM analytics_events').run();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  // --- POST /api/analytics/event ---

  describe('POST /api/analytics/event', () => {
    it('stores a batch of events without auth', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({
          events: [
            { name: 'page_view', path: '/' },
            { name: 'click', path: '/', props: { target: 'btn' } },
            { name: 'scroll', path: '/about' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(3);

      const db = getDb();
      const count = db.prepare('SELECT COUNT(*) as n FROM analytics_events').get() as { n: number };
      expect(count.n).toBe(3);
    });

    it('rejects an empty events array (400)', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({ events: [] });

      expect(res.status).toBe(400);
    });

    it('rejects a missing events field (400)', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({ data: 'no-events' });

      expect(res.status).toBe(400);
    });

    it('accepts a batch of exactly 20 events (boundary)', async () => {
      const events = Array.from({ length: 20 }, (_, i) => ({
        name: `event_${i}`,
        path: '/test',
      }));

      const res = await request(app)
        .post('/api/analytics/event')
        .send({ events });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(20);

      const db = getDb();
      const count = db.prepare('SELECT COUNT(*) as n FROM analytics_events').get() as { n: number };
      expect(count.n).toBe(20);
    });

    it('rejects batches larger than 20 events (400)', async () => {
      const events = Array.from({ length: 25 }, (_, i) => ({
        name: `event_${i}`,
        path: '/test',
      }));

      const res = await request(app)
        .post('/api/analytics/event')
        .send({ events });

      expect(res.status).toBe(400);
    });

    it('persists single event fields correctly', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({
          events: [
            {
              name: 'page_view',
              path: '/tarot/daily',
              referrer: 'https://google.com',
              session_id: 'sess-abc-123',
              props: { variant: 'A' },
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(1);

      const db = getDb();
      const row = db.prepare('SELECT * FROM analytics_events WHERE name = ?').get('page_view') as {
        name: string;
        path: string;
        referrer: string;
        session_id: string;
        props: string;
      };
      expect(row).toBeDefined();
      expect(row.name).toBe('page_view');
      expect(row.path).toBe('/tarot/daily');
      expect(row.referrer).toBe('https://google.com');
      expect(row.session_id).toBe('sess-abc-123');
      expect(JSON.parse(row.props)).toEqual({ variant: 'A' });
    });
  });

  // --- GET /api/analytics/summary ---

  describe('GET /api/analytics/summary', () => {
    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app).get('/api/analytics/summary');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin user (403)', async () => {
      const user = createUser('regular@test.com', 'pass123');
      expect(user).not.toBeNull();
      const res = await request(app)
        .get('/api/analytics/summary')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);

      expect(res.status).toBe(403);
    });

    it('returns summary data for admin', async () => {
      const admin = createAdminUser('admin-test@taronyang.com', 'pass123');
      expect(admin).not.toBeNull();

      const db = getDb();
      const insert = db.prepare(`
        INSERT INTO analytics_events (id, name, props, path, referrer, session_id, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      insert.run('1', 'page_view', '{}', '/', '', 's1', '', '');
      insert.run('2', 'page_view', '{}', '/tarot', '', 's2', '', '');
      insert.run('3', 'click', '{}', '/', '', 's1', '', '');

      const res = await request(app)
        .get('/api/analytics/summary')
        .set('Authorization', `Bearer ${makeToken(admin!.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
      expect(res.body.totalEvents).toBe(3);
      expect(res.body.uniqueSessions).toBe(2);
      expect(Array.isArray(res.body.topEvents)).toBe(true);
      expect(Array.isArray(res.body.dailyTrend)).toBe(true);
      expect(Array.isArray(res.body.pageViews)).toBe(true);

      const pageView = res.body.topEvents.find((e: { name: string }) => e.name === 'page_view');
      expect(pageView).toBeDefined();
      expect(pageView.count).toBe(2);
    });
  });
});
