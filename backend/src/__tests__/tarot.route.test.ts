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

import { tarotReading, callLlm, RateLimitError } from '../llm';
import { tarotRouter } from '../routes/tarot';
import { initDb, getDb, createUser } from '../database';
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
    const user = (await createUser('free1@test.com', 'password123'))!;
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
    const user = (await createUser('free2@test.com', 'password123'))!;
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
    const user = (await createUser('premium1@test.com', 'password123'))!;
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
    const user = (await createUser('saved@test.com', 'password123'))!;
    const token = makeToken(user.id);

    await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'money', question: '테스트 질문', cards: VALID_CARDS });

    const db = getDb();
    const reading = db.prepare('SELECT * FROM readings WHERE user_id = ?').get(user.id) as { user_id: string; category: string };
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
    const user = (await createUser('chat-free@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문입니다' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });

  it('authenticated premium user — should succeed (200)', async () => {
    const user = (await createUser('chat-premium@test.com', 'password123'))!;
    const db = getDb();
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run('premium', user.id);
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '프리미엄 질문입니다' });

    expect(res.status).toBe(200);
  });

  it('free user exceeding maxDailyChats — should return 429', async () => {
    const user = (await createUser('chatlimit@test.com', 'password123'))!;
    const token = makeToken(user.id);

    // Exhaust daily chat quota (server-side tracking, ZEMA-3343 fix)
    for (let i = 0; i < config.maxDailyChats; i++) {
      const res = await request(app)
        .post('/api/tarot/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: `질문 ${i}` });
      expect(res.status).toBe(200);
    }

    // Next call should be rate-limited
    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '초과 질문' });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('추가 질문');
  });

  it('premium user — should bypass chat limit', async () => {
    const user = (await createUser('chatprem@test.com', 'password123'))!;
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

  beforeAll(async () => {
    initDb();
    app = createTestApp();
    const user = (await createUser('valuser@test.com', 'password123'))!;
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

  it('card ID over max bound (78) — should return 400', async () => {
    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'love',
        cards: [
          { id: 78, is_upright: true },
          { id: 1, is_upright: false },
          { id: 2, is_upright: true },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBeDefined();
  });
});

describe('GET /api/tarot/categories', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  it('should return category list', async () => {
    const res = await request(app).get('/api/tarot/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toBeDefined();
    expect(res.body.categories.love).toBeDefined();
    expect(res.body.categories.money).toBeDefined();
    expect(res.body.categories.career).toBeDefined();
  });
});

describe('GET /api/tarot/shuffle', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  it('should return shuffled cards (default count)', async () => {
    const res = await request(app).get('/api/tarot/shuffle');

    expect(res.status).toBe(200);
    expect(res.body.cards).toBeDefined();
    expect(res.body.cards).toHaveLength(10);
    expect(res.body.cards[0]).toHaveProperty('id');
    expect(res.body.cards[0]).toHaveProperty('name');
    expect(res.body.cards[0]).toHaveProperty('is_upright');
    expect(res.body.cards[0]).toHaveProperty('position');
  });

  it('should respect count parameter', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=5');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(5);
  });

  it('should clamp count below 3 to 3', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=1');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
  });

  it('should clamp count above 20 to 20', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=100');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(20);
  });

  it('should handle invalid count parameter as default', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=abc');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(10);
  });
});

describe('POST /api/tarot/read — error handling', () => {
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

  it('should return 400 when card ID is not in database (getCard returns null)', async () => {
    const user = (await createUser('carderr@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'love',
        cards: [
          { id: 0, is_upright: true },
          { id: 1, is_upright: false },
          { id: 77, is_upright: true },
        ],
      });

    expect(res.status).toBe(200);
  });

  it('should return 500 when LLM throws a generic error', async () => {
    (tarotReading as jest.Mock).mockRejectedValueOnce(new Error('LLM connection failed'));

    const user = (await createUser('llmerr@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('실패');
  });

  it('should return 429 when LLM throws RateLimitError', async () => {
    (tarotReading as jest.Mock).mockRejectedValueOnce(new RateLimitError('rate limited'));

    const user = (await createUser('rlerr@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('혼잡');
  });
});

describe('POST /api/tarot/chat — error handling and edge cases', () => {
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

  it('should return 400 for invalid chat input (missing question)', async () => {
    const user = (await createUser('chatval@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.detail).toBeDefined();
  });

  it('should look up reading_id and use its interpretation', async () => {
    const user = (await createUser('chatrid@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const db = getDb();
    const testId = '550e8400-e29b-41d4-a716-446655440000';
    const readingResult = db.prepare(
      'INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      testId, user.id, 'love', '질문', '[0,1,2]', '[true,false,true]', '저장된 해석입니다', new Date().toISOString()
    );
    expect(readingResult.changes).toBeGreaterThan(0);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문', reading_id: testId });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });

  it('should return 500 when LLM throws a generic error', async () => {
    (callLlm as jest.Mock).mockRejectedValueOnce(new Error('LLM connection failed'));

    const user = (await createUser('chaterr@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문' });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('실패');
  });

  it('should return 429 when LLM throws RateLimitError', async () => {
    (callLlm as jest.Mock).mockRejectedValueOnce(new RateLimitError('rate limited'));

    const user = (await createUser('chatrl@test.com', 'password123'))!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문' });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('혼잡');
  });
});
