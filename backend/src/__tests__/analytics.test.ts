import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, getDb, createUser, User } from '../database';
import { analyticsRouter, cleanupOldAnalyticsEvents } from '../routes/analytics';
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

async function createAdminUser(email: string, password: string): Promise<User | null> {
  const user = await createUser(email, password);
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

    it('caps batch size at 20 events', async () => {
      const events = Array.from({ length: 25 }, (_, i) => ({
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
      const user = await createUser('regular@test.com', 'pass123');
      expect(user).not.toBeNull();
      const res = await request(app)
        .get('/api/analytics/summary')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);

      expect(res.status).toBe(403);
    });

    it('returns summary data for admin', async () => {
      const admin = await createAdminUser('admin-test@taronyang.com', 'pass123');
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

    it('accepts custom days parameter (clamped to 90)', async () => {
      const admin = (await createAdminUser('admin-test@taronyang.com', 'pass123'))!;
      const res = await request(app)
        .get('/api/analytics/summary?days=30')
        .set('Authorization', `Bearer ${makeToken(admin.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(30);
    });

    it('clamps days parameter above 90', async () => {
      const admin = (await createAdminUser('admin-test@taronyang.com', 'pass123'))!;
      const res = await request(app)
        .get('/api/analytics/summary?days=500')
        .set('Authorization', `Bearer ${makeToken(admin.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(90);
    });

    it('defaults days to 7 for invalid input', async () => {
      const admin = (await createAdminUser('admin-test@taronyang.com', 'pass123'))!;
      const res = await request(app)
        .get('/api/analytics/summary?days=abc')
        .set('Authorization', `Bearer ${makeToken(admin.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
    });
  });

  // --- cleanupOldAnalyticsEvents ---

  describe('cleanupOldAnalyticsEvents', () => {
    it('deletes events older than 90 days', () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO analytics_events (id, name, props, path, referrer, session_id, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-100 days'))
      `).run('old-1', 'page_view', '{}', '/', '', '', '', '');
      db.prepare(`
        INSERT INTO analytics_events (id, name, props, path, referrer, session_id, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run('new-1', 'page_view', '{}', '/', '', '', '', '');

      const deleted = cleanupOldAnalyticsEvents();
      expect(deleted).toBe(1);

      const remaining = db.prepare('SELECT id FROM analytics_events').all() as { id: string }[];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('new-1');
    });

    it('returns 0 when no old events exist', () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO analytics_events (id, name, props, path, referrer, session_id, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run('recent-1', 'page_view', '{}', '/', '', '', '', '');

      const deleted = cleanupOldAnalyticsEvents();
      expect(deleted).toBe(0);
    });
  });

  // --- POST /api/analytics/event — edge cases ---

  describe('POST /api/analytics/event — edge cases', () => {
    it('handles events with missing optional fields gracefully', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({
          events: [{ name: 'minimal_event' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(1);

      const db = getDb();
      const row = db.prepare('SELECT * FROM analytics_events WHERE name = ?').get('minimal_event') as {
        path: string; referrer: string; session_id: string; props: string;
      };
      expect(row.path).toBe('');
      expect(row.props).toBe('{}');
    });

    it('handles props with undefined values gracefully', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .send({
          events: [{ name: 'undef_test', props: { a: undefined, b: 'ok' } }],
        });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(1);

      const db = getDb();
      const row = db.prepare('SELECT props FROM analytics_events WHERE name = ?').get('undef_test') as { props: string };
      const parsed = JSON.parse(row.props);
      expect(parsed.b).toBe('ok');
    });

    it('extracts IP from x-forwarded-for header', async () => {
      const res = await request(app)
        .post('/api/analytics/event')
        .set('X-Forwarded-For', '203.0.113.1, 198.51.100.2')
        .send({ events: [{ name: 'ip_test' }] });

      expect(res.status).toBe(201);

      const db = getDb();
      const row = db.prepare('SELECT ip FROM analytics_events WHERE name = ?').get('ip_test') as { ip: string };
      expect(row.ip).toBe('203.0.113.1');
    });
  });
});
