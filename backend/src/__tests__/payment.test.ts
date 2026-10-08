import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { paymentRouter } from '../routes/payment';
import { initDb, getDb, createUser } from '../database';
import { config } from '../config';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/payment', paymentRouter);
  return app;
}

describe('Payment routes', () => {
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

  function authHeader(userId: string): Record<string, string> {
    return { Authorization: `Bearer ${makeToken(userId)}` };
  }

  function setPremium(userId: string, expiresAt: string | null): void {
    getDb()
      .prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
      .run(expiresAt, userId);
  }

  // --- GET /payment/price ---

  it('GET /payment/price — returns pricing without auth', async () => {
    const res = await request(app).get('/payment/price');
    expect(res.status).toBe(200);
    expect(res.body.premium_price).toBeDefined();
    expect(res.body.currency).toBe('KRW');
  });

  // --- GET /payment/status ---

  it('GET /payment/status — rejects unauthenticated (401)', async () => {
    const res = await request(app).get('/payment/status');
    expect(res.status).toBe(401);
  });

  it('GET /payment/status — free user gets free status', async () => {
    const user = createUser('free@example.com', 'password123', 'freeuser')!;
    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
  });

  it('GET /payment/status — active premium user gets premium status', async () => {
    const user = createUser('premium@example.com', 'password123', 'premiumuser')!;
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setPremium(user.id, future);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('premium');
  });

  it('GET /payment/status — expired premium auto-downgrades to free', async () => {
    const user = createUser('expired@example.com', 'password123', 'expireduser')!;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    setPremium(user.id, past);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');

    const updated = getDb()
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('free');
  });

  it('GET /payment/status — active cancelling user gets cancelling status', async () => {
    const user = createUser('cancelling@example.com', 'password123', 'cancellinguser')!;
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    getDb()
      .prepare("UPDATE users SET subscription_status = 'cancelling', subscription_expires_at = ? WHERE id = ?")
      .run(future, user.id);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelling');
  });

  it('GET /payment/status — expired cancelling auto-downgrades to free', async () => {
    const user = createUser('expired-cancelling@example.com', 'password123', 'expiredcancel')!;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    getDb()
      .prepare("UPDATE users SET subscription_status = 'cancelling', subscription_expires_at = ? WHERE id = ?")
      .run(past, user.id);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
    expect(res.body.expires_at).toBeNull();

    const updated = getDb()
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('free');
  });

  it('GET /payment/status — expired premium returns null expires_at after downgrade', async () => {
    const user = createUser('expired-status@example.com', 'password123', 'expiredstatus')!;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    setPremium(user.id, past);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
    expect(res.body.expires_at).toBeNull();
  });

  // --- POST /payment/cancel ---

  it('POST /payment/cancel — rejects unauthenticated (401)', async () => {
    const res = await request(app).post('/payment/cancel');
    expect(res.status).toBe(401);
  });

  it('POST /payment/cancel — rejects free user (400)', async () => {
    const user = createUser('cancel-free@example.com', 'password123', 'cancelfree')!;
    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));
    expect(res.status).toBe(400);
  });

  it('POST /payment/cancel — active premium user can cancel (200)', async () => {
    const user = createUser('cancel-prem@example.com', 'password123', 'cancelprem')!;
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setPremium(user.id, future);

    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const updated = getDb()
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('cancelling');
  });

  it('POST /payment/cancel — expired premium is downgraded and rejected (400)', async () => {
    const user = createUser('expired-cancel@example.com', 'password123', 'expiredcancel')!;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    setPremium(user.id, past);

    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));
    expect(res.status).toBe(400);

    const updated = getDb()
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('free');
  });

  it('POST /payment/cancel — expired cancelling is downgraded and rejected (400)', async () => {
    const user = createUser('expired-cancel-cancelling@example.com', 'password123', 'expiredcancelc')!;
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    getDb()
      .prepare("UPDATE users SET subscription_status = 'cancelling', subscription_expires_at = ? WHERE id = ?")
      .run(past, user.id);

    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));
    expect(res.status).toBe(400);

    const updated = getDb()
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('free');
  });

  // --- POST /payment/verify ---

  it('POST /payment/verify — rejects unauthenticated (401)', async () => {
    const res = await request(app)
      .post('/payment/verify')
      .send({ imp_uid: 'test-uid' });
    expect(res.status).toBe(401);
  });

  it('POST /payment/verify — rejects invalid body (400)', async () => {
    const user = createUser('verify@example.com', 'password123', 'verifyuser')!;
    const res = await request(app)
      .post('/payment/verify')
      .set(authHeader(user.id))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /payment/verify — server error returns 502 not 400', async () => {
    // Make the test environment-independent: ensure the route reaches the
    // network layer (bypass the missing-API-key guard) and explicitly mock
    // a PortOne API failure rather than relying on implicit env configuration.
    const origKey = config.portOneImpKey;
    const origSecret = config.portOneImpSecret;
    config.portOneImpKey = 'test-key';
    config.portOneImpSecret = 'test-secret';

    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Simulated API error'));

    try {
      const user = createUser('verify-err@example.com', 'password123', 'verifyerr')!;
      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'test-uid-123' });
      expect(res.status).toBe(502);
      expect(res.body.detail).toBeDefined();
    } finally {
      fetchSpy.mockRestore();
      config.portOneImpKey = origKey;
      config.portOneImpSecret = origSecret;
    }
  });
});
