import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../llm', () => {
  class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }
  return {
    tarotReading: jest.fn().mockResolvedValue('테스트 타로 해석 결과입니다.'),
    callLlm: jest.fn().mockResolvedValue('테스트 채팅 응답입니다.'),
    RateLimitError,
  };
});

import { tarotRouter } from '../routes/tarot';
import { tarotReading, callLlm, RateLimitError } from '../llm';
import { initDb, getDb, createUser, getUserById, User } from '../database';
import { config } from '../config';

const VALID_CARDS = [
  { id: 0, is_upright: true },
  { id: 1, is_upright: false },
  { id: 2, is_upright: true },
];

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tarot', tarotRouter);
  return app;
}

describe('POST /api/tarot/read — auth required', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM users').run();
  });

  it('unauthenticated request — should return 401 with detail message', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('로그인이 필요합니다');
  });

  it('missing Authorization header — should return 401', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBeDefined();
  });

  it('invalid JWT — should return 401', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', 'Bearer invalid-token')
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(401);
  });

  it('authenticated free user — first read should succeed (200)', async () => {
    const user = createUser('free1@test.com', 'password123')!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(200);
    expect(res.body.interpretation).toBeDefined();
    expect(res.body.remaining_free).toBe(0);
    expect(res.body.cards).toHaveLength(3);
  });

  it('authenticated free user — second read should be blocked (429)', async () => {
    const user = createUser('free2@test.com', 'password123')!;
    const token = makeToken(user.id);

    const first = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });
    expect(second.status).toBe(429);
    expect(second.body.detail).toContain('무료');
    expect(second.body.remaining).toBe(0);
  });

  it('authenticated premium user — should bypass quota (multiple reads OK)', async () => {
    const user = createUser('premium1@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);

    const token = makeToken(user.id);

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/tarot/read')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'love', cards: VALID_CARDS });
      expect(res.status).toBe(200);
      expect(res.body.remaining_free).toBe(-1);
    }
  });

  it('authenticated user — reading saved with user_id', async () => {
    const user = createUser('saved@test.com', 'password123')!;
    const token = makeToken(user.id);

    await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'money', question: '테스트 질문', cards: VALID_CARDS });

    const db = getDb();
    const reading = db.prepare('SELECT * FROM readings WHERE user_id = ?').get(user.id) as any;
    expect(reading).toBeDefined();
    expect(reading.user_id).toBe(user.id);
    expect(reading.category).toBe('money');
  });
});

describe('POST /api/tarot/chat — auth + chat limit', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM users').run();
  });

  it('unauthenticated request — should return 401 with detail message', async () => {
    const res = await request(app)
      .post('/api/tarot/chat')
      .send({ question: '추가 질문입니다' });

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('로그인이 필요합니다');
  });

  it('authenticated free user — should succeed (200)', async () => {
    const user = createUser('chat-free@test.com', 'password123')!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문입니다' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });

  it('authenticated premium user — should succeed (200)', async () => {
    const user = createUser('chat-premium@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '프리미엄 질문입니다' });

    expect(res.status).toBe(200);
  });

  it('free user exceeding maxChatPerReading — should return 429', async () => {
    const user = createUser('chatlimit@test.com', 'password123')!;
    const token = makeToken(user.id);

    const maxItems = 9;
    const fakeHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    for (let i = 0; i < maxItems; i++) {
      fakeHistory.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `메시지 ${i}`,
      });
    }

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '초과 질문', chat_history: fakeHistory });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('추가 질문');
  });

  it('premium user — should bypass chat limit', async () => {
    const user = createUser('chatprem@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    const token = makeToken(user.id);

    const fakeHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    for (let i = 0; i < 9; i++) {
      fakeHistory.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `메시지 ${i}`,
      });
    }

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '프리미엄 질문', chat_history: fakeHistory });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/tarot/read — input validation', () => {
  let app: express.Application;
  let token: string;

  beforeAll(() => {
    initDb();
    app = createTestApp();
    const user = createUser('valuser@test.com', 'password123')!;
    token = makeToken(user.id);
  });

  it('missing cards — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love' });
    expect(res.status).toBe(400);
  });

  it('duplicate card IDs — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'love',
        cards: [
          { id: 0, is_upright: true },
          { id: 0, is_upright: false },
          { id: 1, is_upright: true },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('invalid category — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'nonexistent', cards: VALID_CARDS });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tarot/categories', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  it('should return 200 with all 6 categories and non-empty display names', async () => {
    const res = await request(app).get('/api/tarot/categories');

    expect(res.status).toBe(200);
    const categories = res.body.categories;
    expect(categories).toBeDefined();
    expect(typeof categories).toBe('object');

    const keys = Object.keys(categories);
    expect(keys).toHaveLength(6);
    expect(keys).toEqual(
      expect.arrayContaining([
        'love', 'money', 'career', 'general', 'newyear', 'compatibility',
      ]),
    );

    for (const val of Object.values(categories)) {
      expect(typeof val).toBe('string');
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

describe('GET /api/tarot/shuffle', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  it('should return 200 with cards array (no auth required)', async () => {
    const res = await request(app).get('/api/tarot/shuffle');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
  });

  it.each([
    ['default (no param)', '', 10],
    ['count=5', '5', 5],
    ['count=3 (min boundary)', '3', 3],
    ['count=20 (max boundary)', '20', 20],
    ['count=2 (below min, clamp to 3)', '2', 3],
    ['count=0 (falsy, default 10)', '0', 10],
    ['count=-5 (negative, clamp to 3)', '-5', 3],
    ['count=50 (above max, clamp to 20)', '50', 20],
    ['count=abc (non-numeric, default 10)', 'abc', 10],
    ['count= (empty, default 10)', '', 10],
  ])('should return correct card count for ?count=%s', async (_label, count, expected) => {
    const url = count ? `/api/tarot/shuffle?count=${count}` : '/api/tarot/shuffle';
    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(expected);
  });

  it('should return valid cards with correct structure, unique IDs, and consistent position', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=20');

    expect(res.status).toBe(200);
    const cards = res.body.cards;

    for (const card of cards) {
      expect(card).toHaveProperty('id');
      expect(typeof card.id).toBe('number');
      expect(card.id).toBeGreaterThanOrEqual(0);
      expect(card.id).toBeLessThanOrEqual(77);
      expect(card).toHaveProperty('name');
      expect(typeof card.name).toBe('string');
      expect(card).toHaveProperty('name_en');
      expect(typeof card.name_en).toBe('string');
      expect(card).toHaveProperty('symbol');
      expect(typeof card.symbol).toBe('string');
      expect(card).toHaveProperty('is_upright');
      expect(typeof card.is_upright).toBe('boolean');
      expect(card).toHaveProperty('position');
      expect(['정위치', '역위치']).toContain(card.position);

      if (card.is_upright) {
        expect(card.position).toBe('정위치');
      } else {
        expect(card.position).toBe('역위치');
      }
    }

    const ids = cards.map((c: { id: number }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('POST /api/tarot/read — card lookup error branches', () => {
  let app: express.Application;
  let token: string;

  beforeAll(() => {
    initDb();
    app = createTestApp();
    const user = createUser('readerr@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    token = makeToken(user.id);
  });

  it('non-existent card ID — should return 400 with detail', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'love',
        cards: [
          { id: 0, is_upright: true },
          { id: 1, is_upright: false },
          { id: 999, is_upright: true },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('카드 없음');
  });
});

describe('POST /api/tarot/read — AI error branches', () => {
  let app: express.Application;
  let token: string;

  beforeAll(() => {
    initDb();
    app = createTestApp();
    const user = createUser('readai@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    token = makeToken(user.id);
  });

  afterEach(() => {
    (tarotReading as jest.Mock).mockResolvedValue('테스트 타로 해석 결과입니다.');
  });

  it('AI RateLimitError — should return 429 with friendly message', async () => {
    (tarotReading as jest.Mock).mockRejectedValueOnce(new RateLimitError('429 Too Many Requests'));

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('AI 서버');
  });

  it('AI generic error — should return 500 with friendly message', async () => {
    (tarotReading as jest.Mock).mockRejectedValueOnce(new Error('Internal Server Error'));

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('AI 해석');
  });
});

describe('POST /api/tarot/chat — validation and AI error branches', () => {
  let app: express.Application;
  let token: string;

  beforeAll(() => {
    initDb();
    app = createTestApp();
    const user = createUser('chaterr@test.com', 'password123')!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    token = makeToken(user.id);
  });

  afterEach(() => {
    (callLlm as jest.Mock).mockResolvedValue('테스트 채팅 응답입니다.');
  });

  it('empty question — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toBeDefined();
  });

  it('missing question field — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.detail).toBeDefined();
  });

  it('AI RateLimitError — should return 429 with friendly message', async () => {
    (callLlm as jest.Mock).mockRejectedValueOnce(new RateLimitError('429 Too Many Requests'));

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '질문입니다' });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('AI 서버');
  });

  it('AI generic error — should return 500 with friendly message', async () => {
    (callLlm as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '질문입니다' });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('AI 응답');
  });
});
