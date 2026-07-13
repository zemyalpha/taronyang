import express, { Express } from 'express';
import request from 'supertest';
import { initDb, getDb, createUser } from '../src/database';
import { authRouter } from '../src/routes/auth';
import { paymentRouter } from '../src/routes/payment';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/payment', paymentRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, TEST_SECRET, { expiresIn: '7d' });
}

describe('payment routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    app = createApp();
  });

  describe('GET /payment/price', () => {
    it('returns price info without auth', async () => {
      const res = await request(app).get('/payment/price');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('premium_price');
      expect(res.body).toHaveProperty('currency', 'KRW');
      expect(res.body).toHaveProperty('interval', 'monthly');
    });
  });

  describe('GET /payment/status', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/payment/status');
      expect(res.status).toBe(401);
    });

    it('returns free status for new user', async () => {
      const user = createUser('free-test@test.com', 'pass123');
      expect(user).not.toBeNull();
      const res = await request(app)
        .get('/payment/status')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('free');
    });

    it('returns premium status with expiry', async () => {
      const user = createUser('premium-test@test.com', 'pass123');
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      getDb().prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
        .run(expires, user!.id);

      const res = await request(app)
        .get('/payment/status')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('premium');
      expect(res.body.expires_at).toBe(expires);
    });

    it('downgrades expired premium to free', async () => {
      const user = createUser('expired-premium@test.com', 'pass123');
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      getDb().prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
        .run(pastDate, user!.id);

      const res = await request(app)
        .get('/payment/status')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('free');
    });
  });

  describe('POST /payment/cancel', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/payment/cancel');
      expect(res.status).toBe(401);
    });

    it('rejects free user trying to cancel', async () => {
      const user = createUser('cancel-free@test.com', 'pass123');
      const res = await request(app)
        .post('/payment/cancel')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('프리미엄');
    });

    it('sets premium user to cancelling', async () => {
      const user = createUser('cancel-premium@test.com', 'pass123');
      getDb().prepare("UPDATE users SET subscription_status = 'premium' WHERE id = ?").run(user!.id);

      const res = await request(app)
        .post('/payment/cancel')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('POST /payment/verify', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/payment/verify').send({ imp_uid: 'test-uid' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid body (missing imp_uid)', async () => {
      const user = createUser('verify-bad@test.com', 'pass123');
      const res = await request(app)
        .post('/payment/verify')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});

describe('auth middleware', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    app = createApp();
  });

  it('rejects request with no token', async () => {
    const res = await request(app).get('/payment/status');
    expect(res.status).toBe(401);
    expect(res.body.detail).toContain('로그인');
  });

  it('rejects request with malformed token', async () => {
    const res = await request(app)
      .get('/payment/status')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('rejects request with token from different secret', async () => {
    const wrongToken = jwt.sign({ user_id: 'fake' }, 'wrong-secret');
    const res = await request(app)
      .get('/payment/status')
      .set('Authorization', `Bearer ${wrongToken}`);
    expect(res.status).toBe(401);
  });

  it('accepts valid token for existing user', async () => {
    const user = createUser('auth-valid@test.com', 'pass123');
    const res = await request(app)
      .get('/payment/status')
      .set('Authorization', `Bearer ${makeToken(user!.id)}`);
    expect(res.status).toBe(200);
  });
});
