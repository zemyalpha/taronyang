import { Express } from 'express';
import request from 'supertest';

type AppModule = typeof import('../index');

describe('apiLimiter 전용 limiter 경로 skip (ZEMA-4284)', () => {
  let app: Express;

  const loadApp = async (): Promise<void> => {
    jest.resetModules();
    const mod: AppModule = await import('../index');
    app = mod.default;
  };

  const remaining = async (path = '/api/health'): Promise<string> => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    return String(res.headers['ratelimit-remaining']);
  };

  beforeEach(async () => {
    await loadApp();
  });

  it('타로 전용 limiter 경로(/api/tarot/read)는 apiLimiter 카운트를 소진시키지 않는다', async () => {
    expect(await remaining()).toBe('99');

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/tarot/read');
      expect(res.status).toBe(401);
    }

    expect(await remaining()).toBe('98');
  });

  it('결제 전용 limiter 경로(/api/payment/verify)는 apiLimiter 카운트를 소진시키지 않는다', async () => {
    expect(await remaining()).toBe('99');

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/api/payment/verify');
      expect(res.status).toBe(401);
    }

    expect(await remaining()).toBe('98');
  });

  it('인증 전용 limiter 경로(/api/auth/login)는 apiLimiter 카운트를 소진시키지 않는다', async () => {
    expect(await remaining()).toBe('99');

    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);

    expect(await remaining()).toBe('98');
  });

  it('쿼리스트링이 붙은 전용 limiter 경로도 skip된다', async () => {
    expect(await remaining()).toBe('99');

    const res = await request(app).post('/api/tarot/read?lang=ko');
    expect(res.status).toBe(401);

    expect(await remaining()).toBe('98');
  });

  it('전용 limiter가 없는 경로는 여전히 apiLimiter가 카운트한다', async () => {
    expect(await remaining()).toBe('99');

    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(401);

    expect(await remaining()).toBe('97');
  });

  it('일반 경로 100회 초과 시 apiLimiter가 여전히 429로 차단한다', async () => {
    for (let i = 0; i < 100; i += 1) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/api/health');
    expect(blocked.status).toBe(429);
    expect(blocked.body.detail).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
  });
});
