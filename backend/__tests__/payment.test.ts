import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { paymentRouter } from '../src/routes/payment';
import { initDb, createUser, getDb } from '../src/database';

const app = express();
app.use(express.json());
app.use('/payment', paymentRouter);

beforeAll(() => {
  initDb();
});

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, 'test-secret-key');
}

function authHeader(userId: string): { Authorization: string } {
  return { Authorization: `Bearer ${makeToken(userId)}` };
}

afterEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM processed_payments').run();
  db.prepare('DELETE FROM users').run();
});

describe('GET /payment/price', () => {
  it('returns price info without authentication', async () => {
    const res = await request(app).get('/payment/price');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('premium_price');
    expect(res.body).toHaveProperty('currency', 'KRW');
    expect(res.body).toHaveProperty('interval', 'monthly');
  });
});

describe('GET /payment/status', () => {
  it('rejects requests without auth (401)', async () => {
    const res = await request(app).get('/payment/status');
    expect(res.status).toBe(401);
  });

  it('returns "free" for a free-tier user', async () => {
    const user = createUser('free@example.com', 'password123', 'freeuser')!;
    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
  });

  it('returns "premium" for a premium user', async () => {
    const user = createUser('premium@example.com', 'password123', 'premiumuser')!;
    const db = getDb();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
      .run(expires, user.id);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('premium');
    expect(res.body.expires_at).toBeTruthy();
  });

  it('auto-downgrades an expired premium subscription to free', async () => {
    const user = createUser('expired@example.com', 'password123', 'expireduser')!;
    const db = getDb();
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
      .run(pastDate, user.id);

    const res = await request(app)
      .get('/payment/status')
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('free');
  });
});

describe('POST /payment/cancel', () => {
  it('rejects requests without auth (401)', async () => {
    const res = await request(app).post('/payment/cancel');
    expect(res.status).toBe(401);
  });

  it('rejects cancellation for a free-tier user (400)', async () => {
    const user = createUser('free2@example.com', 'password123', 'freeuser2')!;
    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));

    expect(res.status).toBe(400);
  });

  it('succeeds for a premium user and sets status to "cancelling"', async () => {
    const user = createUser('cancel@example.com', 'password123', 'canceluser')!;
    const db = getDb();
    db.prepare("UPDATE users SET subscription_status = 'premium' WHERE id = ?").run(user.id);

    const res = await request(app)
      .post('/payment/cancel')
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const updated = db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(user.id) as { subscription_status: string };
    expect(updated.subscription_status).toBe('cancelling');
  });
});

describe('POST /payment/verify', () => {
  it('rejects requests without auth (401)', async () => {
    const res = await request(app)
      .post('/payment/verify')
      .send({ imp_uid: 'test-uid' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid body with no imp_uid (400)', async () => {
    const user = createUser('verify@example.com', 'password123', 'verifyuser')!;
    const res = await request(app)
      .post('/payment/verify')
      .set(authHeader(user.id))
      .send({});

    expect(res.status).toBe(400);
  });
});
