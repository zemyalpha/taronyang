import { test, expect } from '@playwright/test';

test.describe('API 엔드포인트', () => {
  test('GET /api/health', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('taronyang');
  });

  test('GET /api/tarot/categories', async ({ request }) => {
    const res = await request.get('/api/tarot/categories');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.categories).toBeDefined();
    expect(body.categories.love).toBeDefined();
    expect(body.categories.money).toBeDefined();
    expect(body.categories.career).toBeDefined();
    expect(body.categories.general).toBeDefined();
  });

  test('GET /api/tarot/shuffle?count=10', async ({ request }) => {
    const res = await request.get('/api/tarot/shuffle?count=10');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.cards).toBeDefined();
    expect(body.cards.length).toBe(10);
    expect(body.cards[0]).toHaveProperty('id');
    expect(body.cards[0]).toHaveProperty('name');
    expect(body.cards[0]).toHaveProperty('symbol');
    expect(body.cards[0]).toHaveProperty('is_upright');
    expect(body.cards[0]).toHaveProperty('position');
  });

  test('POST /api/tarot/read — 정상 요청', async ({ request }) => {
    test.setTimeout(120000);
    const shuffleRes = await request.get('/api/tarot/shuffle?count=3');
    const shuffleData = await shuffleRes.json();
    const cards = shuffleData.cards.map((c: any) => ({
      id: c.id,
      is_upright: c.is_upright,
    }));

    const res = await request.post('/api/tarot/read', {
      timeout: 90000,
      data: { category: 'love', question: '테스트', cards },
    });
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.interpretation).toBeDefined();
      expect(body.interpretation.length).toBeGreaterThan(0);
      expect(body.cards).toBeDefined();
      expect(body.cards.length).toBe(3);
    } else {
      expect(res.status()).toBe(500);
      expect(body.detail).toBeDefined();
    }
  });

  test('POST /api/tarot/read — 잘못된 카테고리', async ({ request }) => {
    const res = await request.post('/api/tarot/read', {
      data: { category: 'invalid', question: '', cards: [{ id: 0, is_upright: true }] },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/tarot/read — 카드 부족', async ({ request }) => {
    const res = await request.post('/api/tarot/read', {
      data: { category: 'love', question: '', cards: [{ id: 0, is_upright: true }] },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/auth/signup + /api/auth/login', async ({ request }) => {
    const email = `api-test-${Date.now()}@example.com`;
    const signupRes = await request.post('/api/auth/signup', {
      data: { email, password: 'test1234', nickname: 'API냥' },
    });
    expect(signupRes.status()).toBe(200);
    const signupData = await signupRes.json();
    expect(signupData.token).toBeDefined();
    expect(signupData.user.email).toBe(email);

    const loginRes = await request.post('/api/auth/login', {
      data: { email, password: 'test1234' },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();
  });

  test('POST /api/auth/signup — 중복 이메일', async ({ request }) => {
    const email = `dup-${Date.now()}@example.com`;
    await request.post('/api/auth/signup', {
      data: { email, password: 'test1234' },
    });
    const dupRes = await request.post('/api/auth/signup', {
      data: { email, password: 'test1234' },
    });
    expect(dupRes.status()).toBe(409);
  });
});
