import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { initDb, createUser, getDb } from '../database';
import { config } from '../config';
import { notifyRouter } from '../routes/notify';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notifyRouter);
  return app;
}

describe('notifyRouter', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM users').run();
  });

  function makeToken(userId: string): string {
    return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('GET /settings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/notifications/settings');
      expect(res.status).toBe(401);
    });

    it('returns default settings for new user', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .get('/api/notifications/settings')
        .set(authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.daily_email).toBe(true);
      expect(res.body.notify_time).toBe('07:00');
      expect(res.body.notify_channel).toBe('email');
      expect(res.body.zodiac_sign).toBe('');
    });

    it('returns stored settings after update', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ daily_email: false, notify_time: '08:00' });

      const res = await request(app)
        .get('/api/notifications/settings')
        .set(authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.daily_email).toBe(false);
      expect(res.body.notify_time).toBe('08:00');
    });
  });

  describe('PUT /settings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/notifications/settings').send({});
      expect(res.status).toBe(401);
    });

    it('updates daily_email setting', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ daily_email: false });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('updates notify_time with valid HH:MM format', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ notify_time: '09:30' });
      expect(res.status).toBe(200);
    });

    it('rejects invalid notify_time format (400)', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ notify_time: '25:00' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid notify_channel (400)', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ notify_channel: 'sms' });
      expect(res.status).toBe(400);
    });

    it('updates all settings together', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/settings')
        .set(authHeader(token))
        .send({ daily_email: true, notify_time: '06:00', notify_channel: 'push' });
      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get('/api/notifications/settings')
        .set(authHeader(token));
      expect(getRes.body.daily_email).toBe(true);
      expect(getRes.body.notify_time).toBe('06:00');
      expect(getRes.body.notify_channel).toBe('push');
    });
  });

  describe('PUT /zodiac', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/notifications/zodiac').send({});
      expect(res.status).toBe(401);
    });

    it('updates zodiac sign with valid value', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/zodiac')
        .set(authHeader(token))
        .send({ zodiac_sign: '양자리' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects invalid zodiac sign (400)', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/zodiac')
        .set(authHeader(token))
        .send({ zodiac_sign: '처인자리' });
      expect(res.status).toBe(400);
    });

    it('rejects missing zodiac_sign field (400)', async () => {
      const user = createUser('test@example.com', 'password123', 'tester')!;
      const token = makeToken(user.id);
      const res = await request(app)
        .put('/api/notifications/zodiac')
        .set(authHeader(token))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /horoscope/:sign', () => {
    it('rejects invalid zodiac sign (400)', async () => {
      const res = await request(app).get('/api/notifications/horoscope/처인자리');
      expect(res.status).toBe(400);
      expect(res.body.detail).toBe('유효하지 않은 별자리입니다');
    });

    it('accepts valid zodiac sign without auth (public endpoint)', async () => {
      const validSigns = [
        '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
        '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
      ];
      for (const sign of validSigns) {
        const res = await request(app).get(`/api/notifications/horoscope/${sign}`);
        expect(res.status).not.toBe(400);
      }
    });
  });
});
