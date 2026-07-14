import express, { Express } from 'express';
import request from 'supertest';
import { initDb, createUser, getDb } from '../database';
import { authRouter } from '../routes/auth';
import { analyticsRouter } from '../routes/analytics';
import { config } from '../config';
import jwt from 'jsonwebtoken';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/analytics', analyticsRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

let testCounter = 0;

function createAdminUser(): NonNullable<ReturnType<typeof createUser>> {
  testCounter++;
  const email = `admin-test-${testCounter}@taronyang.com`;
  const user = createUser(email, 'pass123');
  if (!user) throw new Error('Failed to create admin user');
  getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  user.is_admin = 1;
  return user;
}

describe('analytics routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    app = createApp();
  });

  describe('POST /analytics/event', () => {
    it('stores analytics events without auth', async () => {
      const res = await request(app)
        .post('/analytics/event')
        .send({
          events: [
            { name: 'page_view', path: '/' },
            { name: 'card_click', props: { card: 'fool' } },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(2);
    });

    it('rejects empty events array', async () => {
      const res = await request(app)
        .post('/analytics/event')
        .send({ events: [] });
      expect(res.status).toBe(400);
    });

    it('rejects missing events field', async () => {
      const res = await request(app)
        .post('/analytics/event')
        .send({});
      expect(res.status).toBe(400);
    });

    it('caps batch at 20 events', async () => {
      const events = Array.from({ length: 30 }, (_, i) => ({
        name: `event_${i}`,
      }));
      const res = await request(app)
        .post('/analytics/event')
        .send({ events });
      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(20);
    });

    it('stores single event correctly', async () => {
      const res = await request(app)
        .post('/analytics/event')
        .send({ events: [{ name: 'test_event', path: '/test', session_id: 'sess-1' }] });
      expect(res.status).toBe(201);

      const rows = getDb().prepare('SELECT name, path, session_id FROM analytics_events WHERE name = ?').all('test_event') as Array<{ name: string; path: string; session_id: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test_event');
      expect(rows[0].path).toBe('/test');
      expect(rows[0].session_id).toBe('sess-1');
    });
  });

  describe('GET /analytics/summary', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/analytics/summary');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin user with 403', async () => {
      const user = createUser('nonadmin-an@test.com', 'pass123');
      const res = await request(app)
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(403);
    });

    it('returns summary for admin', async () => {
      const admin = createAdminUser();

      await request(app)
        .post('/analytics/event')
        .send({ events: [{ name: 'page_view', path: '/', session_id: 's1' }] });

      const res = await request(app)
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${makeToken(admin.id)}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalEvents');
      expect(res.body).toHaveProperty('uniqueSessions');
      expect(res.body).toHaveProperty('topEvents');
      expect(res.body).toHaveProperty('dailyTrend');
      expect(res.body.totalEvents).toBeGreaterThanOrEqual(1);
    });
  });
});
