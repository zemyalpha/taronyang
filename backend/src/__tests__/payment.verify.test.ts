import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { paymentRouter } from '../routes/payment';
import { initDb, getDb, createUser, User } from '../database';
import { config } from '../config';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/payment', paymentRouter);
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

const originalFetch = global.fetch;

function mockPortOne(opts: {
  tokenOk?: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentCode?: number;
  paymentMessage?: string;
}): void {
  const {
    tokenOk = true,
    paymentStatus = 'paid',
    paymentAmount = config.premiumPrice,
    paymentCode = 0,
    paymentMessage = '',
  } = opts;

  global.fetch = jest.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = (input as Request).url;
    }

    if (url.includes('/users/getToken')) {
      if (tokenOk) {
        return {
          ok: true,
          json: async () => ({ code: 0, response: { access_token: 'mock-token-123' } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ code: 1, message: 'Invalid API key' }),
      } as Response;
    }

    if (url.includes('/payments/')) {
      if (paymentCode !== 0) {
        return {
          ok: true,
          json: async () => ({ code: paymentCode, message: paymentMessage }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          response: { status: paymentStatus, amount: paymentAmount },
        }),
      } as Response;
    }

    return { ok: false, status: 404 } as Response;
  }) as typeof fetch;
}

describe('POST /payment/verify — PortOne integration', () => {
  let app: Express;

  beforeAll(() => {
    initDb();
    app = createApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM processed_payments').run();
    db.prepare('DELETE FROM users').run();
    config.portOneImpKey = 'test-key';
    config.portOneImpSecret = 'test-secret';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    config.portOneImpKey = '';
    config.portOneImpSecret = '';
  });

  it('should verify payment and activate premium (200)', async () => {
    mockPortOne({ paymentStatus: 'paid', paymentAmount: config.premiumPrice });
    const user = createTestUser('verify-success@test.com', 'password123');

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-success-001' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const db = getDb();
    const updated = db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(user.id);
    expect(updated).toBeDefined();
    expect((updated as { subscription_status: string }).subscription_status).toBe('premium');

    const processed = db.prepare('SELECT * FROM processed_payments WHERE imp_uid = ?').get('imp-success-001') as { user_id: string; amount: number } | undefined;
    expect(processed).toBeDefined();
    expect(processed!.user_id).toBe(user.id);
    expect(processed!.amount).toBe(config.premiumPrice);
  });

  it('should reject duplicate imp_uid (400)', async () => {
    mockPortOne({});
    const user = createTestUser('verify-dup@test.com', 'password123');
    const db = getDb();
    db.prepare('INSERT INTO processed_payments (imp_uid, user_id, amount) VALUES (?, ?, ?)')
      .run('imp-dup-001', user.id, config.premiumPrice);

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-dup-001' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('이미 처리된');
  });

  it('should reject when payment status is not paid (400)', async () => {
    mockPortOne({ paymentStatus: 'ready' });
    const user = createTestUser('verify-unpaid@test.com', 'password123');

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-unpaid-001' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('결제가 완료되지 않았습니다');
  });

  it('should reject when amount does not match (400)', async () => {
    mockPortOne({ paymentAmount: 5000 });
    const user = createTestUser('verify-amount@test.com', 'password123');

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-amount-001' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('결제 금액');
  });

  it('should handle PortOne API error code (400)', async () => {
    mockPortOne({ paymentCode: 1, paymentMessage: 'Payment not found' });
    const user = createTestUser('verify-apierr@test.com', 'password123');

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-apierr-001' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('결제 조회 실패');
  });

  it('should handle PortOne token failure (400)', async () => {
    mockPortOne({ tokenOk: false });
    const user = createTestUser('verify-tokenfail@test.com', 'password123');

    const res = await request(app)
      .post('/payment/verify')
      .set('Authorization', `Bearer ${makeToken(user.id)}`)
      .send({ imp_uid: 'imp-tokenfail-001' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('결제 검증에 실패');
  });
});
