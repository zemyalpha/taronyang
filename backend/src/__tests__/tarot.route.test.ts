import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

class MockRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

jest.mock('../llm', () => ({
  tarotReading: jest.fn().mockResolvedValue('테스트 타로 해석 결과입니다.'),
  callLlm: jest.fn().mockResolvedValue('테스트 채팅 응답입니다.'),
  RateLimitError: MockRateLimitError,
}));

import { tarotRouter } from '../routes/tarot';
import { initDb, getDb, createUser, getUserById, User } from '../database';
import { config } from '../config';
import { tarotReading, callLlm, RateLimitError } from '../llm';

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

  it('should return all category names', async () => {
    const res = await request(app).get('/api/tarot/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toBeDefined();
    expect(res.body.categories.love).toBeDefined();
    expect(res.body.categories.money).toBeDefined();
    expect(Object.keys(res.body.categories).length).toBeGreaterThan(0);
  });
});

describe('GET /api/tarot/shuffle', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  it('should return default 10 cards', async () => {
    const res = await request(app).get('/api/tarot/shuffle');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(10);
    res.body.cards.forEach((card: any) => {
      expect(card.id).toBeDefined();
      expect(card.name).toBeDefined();
      expect(card.is_upright).toBeDefined();
      expect(card.position).toBeDefined();
    });
  });

  it('should respect count param within bounds (5)', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=5');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(5);
  });

  it('should clamp count to minimum 3', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=1');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
  });

  it('should clamp count to maximum 20', async () => {
    const res = await request(app).get('/api/tarot/shuffle?count=100');

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(20);
  });
});

describe('POST /api/tarot/read — error branches', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM users').run();
    (tarotReading as jest.Mock).mockResolvedValue('테스트 타로 해석 결과입니다.');
  });

  afterEach(() => {
    (tarotReading as jest.Mock).mockResolvedValue('테스트 타로 해석 결과입니다.');
  });

  it('non-existent card ID — should return 400', async () => {
    const user = createUser('badcard@test.com', 'password123')!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'love',
        cards: [
          { id: 0, is_upright: true },
          { id: 9999, is_upright: false },
          { id: 2, is_upright: true },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('카드');
  });

  it('LLM RateLimitError — should return 429', async () => {
    const user = createUser('rl1@test.com', 'password123')!;
    const token = makeToken(user.id);

    (tarotReading as jest.Mock).mockRejectedValue(new RateLimitError('429 rate limited'));

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('AI');
  });

  it('LLM general error — should return 500', async () => {
    const user = createUser('err1@test.com', 'password123')!;
    const token = makeToken(user.id);

    (tarotReading as jest.Mock).mockRejectedValue(new Error('AI server down'));

    const res = await request(app)
      .post('/api/tarot/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'love', cards: VALID_CARDS });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('AI');
  });
});

describe('POST /api/tarot/chat — error branches', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM users').run();
    (callLlm as jest.Mock).mockResolvedValue('테스트 채팅 응답입니다.');
  });

  afterEach(() => {
    (callLlm as jest.Mock).mockResolvedValue('테스트 채팅 응답입니다.');
  });

  it('missing question — should return 400', async () => {
    const user = createUser('chatval@test.com', 'password123')!;
    const token = makeToken(user.id);

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('LLM RateLimitError — should return 429', async () => {
    const user = createUser('chatrl@test.com', 'password123')!;
    const token = makeToken(user.id);

    (callLlm as jest.Mock).mockRejectedValue(new RateLimitError('429 rate limited'));

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문' });

    expect(res.status).toBe(429);
    expect(res.body.detail).toContain('AI');
  });

  it('LLM general error — should return 500', async () => {
    const user = createUser('chaterr@test.com', 'password123')!;
    const token = makeToken(user.id);

    (callLlm as jest.Mock).mockRejectedValue(new Error('AI server down'));

    const res = await request(app)
      .post('/api/tarot/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '추가 질문' });

    expect(res.status).toBe(500);
    expect(res.body.detail).toContain('AI');
  });
});
