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
    getDb().prepare('DELETE FROM processed_payments').run();
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

  // --- POST /payment/verify — PortOne API mocking ---

  describe('POST /payment/verify — PortOne API (mocked fetch)', () => {
    let originalFetch: typeof global.fetch;

    beforeAll(() => {
      originalFetch = global.fetch;
      config.portOneImpKey = 'test-imp-key';
      config.portOneImpSecret = 'test-imp-secret';
    });

    afterAll(() => {
      global.fetch = originalFetch;
      config.portOneImpKey = '';
      config.portOneImpSecret = '';
    });

    function mockFetch(tokenResponse: object, paymentResponse?: object): void {
      global.fetch = jest.fn(async (input: string | URL | Request) => {
        const urlStr = typeof input === 'string' ? input : input.toString();
        if (urlStr.includes('/users/getToken')) {
          return { json: async () => tokenResponse } as unknown as Response;
        }
        if (urlStr.includes('/payments/')) {
          return { json: async () => paymentResponse } as unknown as Response;
        }
        return { json: async () => ({}) } as unknown as Response;
      });
    }

    it('successful verification → premium activation (200)', async () => {
      const user = createUser('verify-ok@example.com', 'password123', 'verifyok')!;
      mockFetch(
        { code: 0, response: { access_token: 'mock-access-token' } },
        { code: 0, response: { status: 'paid', amount: config.premiumPrice } },
      );

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_success_001' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = getDb()
        .prepare('SELECT subscription_status, subscription_expires_at FROM users WHERE id = ?')
        .get(user.id) as { subscription_status: string; subscription_expires_at: string };
      expect(updated.subscription_status).toBe('premium');
      expect(updated.subscription_expires_at).not.toBeNull();

      const payment = getDb()
        .prepare('SELECT imp_uid, user_id, amount FROM processed_payments WHERE imp_uid = ?')
        .get('imp_success_001') as { imp_uid: string; user_id: string; amount: number } | undefined;
      expect(payment).toBeDefined();
      expect(payment!.user_id).toBe(user.id);
      expect(payment!.amount).toBe(config.premiumPrice);
    });

    it('duplicate imp_uid replay attack → 400', async () => {
      const user = createUser('verify-dup@example.com', 'password123', 'verifydup')!;
      getDb()
        .prepare('INSERT INTO processed_payments (imp_uid, user_id, amount) VALUES (?, ?, ?)')
        .run('imp_dup_001', user.id, config.premiumPrice);

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_dup_001' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('이미 처리된');
    });

    it('PortOne payment not paid status → 400', async () => {
      const user = createUser('verify-np@example.com', 'password123', 'verifynp')!;
      mockFetch(
        { code: 0, response: { access_token: 'mock-access-token' } },
        { code: 0, response: { status: 'ready', amount: config.premiumPrice } },
      );

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_notpaid_001' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('완료되지 않았습니다');
    });

    it('amount mismatch → 400', async () => {
      const user = createUser('verify-am@example.com', 'password123', 'verifyam')!;
      mockFetch(
        { code: 0, response: { access_token: 'mock-access-token' } },
        { code: 0, response: { status: 'paid', amount: 1000 } },
      );

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_mismatch_001' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('금액이 일치하지 않습니다');
    });

    it('PortOne token fetch failure → 400', async () => {
      const user = createUser('verify-tf@example.com', 'password123', 'verifytf')!;
      mockFetch({ code: 1, message: '잘못된 API 키' });

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_tokenfail_001' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('결제 검증에 실패했습니다');
    });

    it('PortOne API error code → 400', async () => {
      const user = createUser('verify-ae@example.com', 'password123', 'verifyae')!;
      mockFetch(
        { code: 0, response: { access_token: 'mock-access-token' } },
        { code: -1, message: '결제 내역을 찾을 수 없습니다' },
      );

      const res = await request(app)
        .post('/payment/verify')
        .set(authHeader(user.id))
        .send({ imp_uid: 'imp_apierror_001' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('결제 조회 실패');
    });
  });
});
