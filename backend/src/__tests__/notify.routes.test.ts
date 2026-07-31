import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { notifyRouter } from '../routes/notify';
import { initDb, getDb, createUser, User } from '../database';
import { config } from '../config';

jest.mock('../dailyNotify', () => ({
  generateDailyHoroscope: jest.fn().mockResolvedValue('오늘은 운수가 좋습니다'),
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/notify', notifyRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

function createTestUser(email: string, password: string): User {
  const user = createUser(email, password);
  if (!user) throw new Error(`Failed to create test user: ${email}`);
  return user;
}

describe('notify routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  // --- GET /api/notify/settings ---

  describe('GET /api/notify/settings', () => {
    it('returns default settings for new user (200)', async () => {
      const user = createTestUser('settings@test.com', 'password123');
      const res = await request(app)
        .get('/api/notify/settings')
        .set('Authorization', `Bearer ${makeToken(user.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.daily_email).toBe(true);
      expect(res.body.notify_time).toBe('07:00');
      expect(res.body.notify_channel).toBe('email');
      expect(res.body.zodiac_sign).toBe('');
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app).get('/api/notify/settings');
      expect(res.status).toBe(401);
    });
  });

  // --- PUT /api/notify/settings ---

  describe('PUT /api/notify/settings', () => {
    it('updates daily_email, notify_time, notify_channel (200)', async () => {
      const user = createTestUser('update@test.com', 'password123');
      const res = await request(app)
        .put('/api/notify/settings')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ daily_email: false, notify_time: '09:30', notify_channel: 'push' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const res2 = await request(app)
        .get('/api/notify/settings')
        .set('Authorization', `Bearer ${makeToken(user.id)}`);
      expect(res2.body.daily_email).toBe(false);
      expect(res2.body.notify_time).toBe('09:30');
      expect(res2.body.notify_channel).toBe('push');
    });

    it('rejects invalid time format (400)', async () => {
      const user = createTestUser('badtime@test.com', 'password123');
      const res = await request(app)
        .put('/api/notify/settings')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ notify_time: '25:00' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid channel (400)', async () => {
      const user = createTestUser('badchan@test.com', 'password123');
      const res = await request(app)
        .put('/api/notify/settings')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ notify_channel: 'sms' });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app)
        .put('/api/notify/settings')
        .send({ daily_email: false });

      expect(res.status).toBe(401);
    });
  });

  // --- PUT /api/notify/zodiac ---

  describe('PUT /api/notify/zodiac', () => {
    it('updates zodiac sign (200)', async () => {
      const user = createTestUser('zodiac@test.com', 'password123');
      const res = await request(app)
        .put('/api/notify/zodiac')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ zodiac_sign: '양자리' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const db = getDb();
      const row = db.prepare('SELECT zodiac_sign FROM users WHERE id = ?').get(user?.id || '') as { zodiac_sign: string } | undefined;
      expect(row?.zodiac_sign).toBe('양자리');
    });

    it('rejects invalid zodiac sign (400)', async () => {
      const user = createTestUser('badzod@test.com', 'password123');
      const res = await request(app)
        .put('/api/notify/zodiac')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ zodiac_sign: '거짓자리' });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app)
        .put('/api/notify/zodiac')
        .send({ zodiac_sign: '양자리' });

      expect(res.status).toBe(401);
    });
  });

  // --- GET /api/notify/horoscope/:sign ---

  describe('GET /api/notify/horoscope/:sign', () => {
    it('returns horoscope for valid sign (200)', async () => {
      const res = await request(app).get('/api/notify/horoscope/양자리');

      expect(res.status).toBe(200);
      expect(res.body.zodiac_sign).toBe('양자리');
      expect(res.body.date).toBeDefined();
      expect(res.body.horoscope).toBeDefined();
    });

    it('rejects invalid sign (400)', async () => {
      const res = await request(app).get('/api/notify/horoscope/거짓자리');

      expect(res.status).toBe(400);
    });
  });
});
