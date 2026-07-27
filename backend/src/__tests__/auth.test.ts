import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { authMiddleware, authRouter } from '../routes/auth';
import { initDb, createUser, getDb, isAccountLocked } from '../database';
import { config } from '../config';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ ok: true, user_id: req.user!.id });
  });
  return app;
}

function createAuthApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
}

describe('authMiddleware', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM users').run();
  });

  function makeToken(userId: string, secret?: string): string {
    return jwt.sign({ user_id: userId }, secret ?? config.jwtSecret, { expiresIn: '7d' });
  }

  it('rejects request without Authorization header (401)', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.detail).toBeDefined();
  });

  it('rejects request with malformed token (401)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('rejects request signed with wrong secret (401)', async () => {
    const user = (await createUser('wrong-secret@example.com', 'password123', 'wrongsecret'))!;
    const token = makeToken(user.id, 'a-completely-different-secret');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and populates req.user (200)', async () => {
    const user = (await createUser('valid@example.com', 'password123', 'validuser'))!;
    const token = makeToken(user.id);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(user.id);
  });
});

describe('authMiddleware token_version (ZEMA-3412)', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM users').run();
  });

  function makeVersionedToken(userId: string, tokenVersion: number): string {
    return jwt.sign({ user_id: userId, v: tokenVersion }, config.jwtSecret, { expiresIn: '7d' });
  }

  it('accepts a token whose v matches user token_version (200) — regression for 401 on new login/signup', async () => {
    const user = (await createUser('versioned@example.com', 'password123', 'versioned'))!;
    const token = makeVersionedToken(user.id, user.token_version);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(user.id);
  });

  it('still rejects a stale token after token_version bump (401) — revocation intact', async () => {
    const user = (await createUser('revoked@example.com', 'password123', 'revoked'))!;
    const staleToken = makeVersionedToken(user.id, user.token_version);
    getDb().prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${staleToken}`);
    expect(res.status).toBe(401);
  });
});

describe('login brute force protection', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createAuthApp();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM users').run();
    getDb().prepare('DELETE FROM login_attempts').run();
  });

  it('locks account after 5 failed login attempts (429)', async () => {
    await createUser('bruteforce@example.com', 'correctpass', 'bruteforce');

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bruteforce@example.com', password: 'wrongpass' });
      if (i < 4) {
        expect(res.status).toBe(401);
      } else {
        expect(res.status).toBe(429);
        expect(res.body.detail).toContain('초과');
      }
    }
  });

  it('returns 429 on subsequent attempts while locked', async () => {
    await createUser('locked@example.com', 'correctpass', 'locked');

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'locked@example.com', password: 'wrongpass' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'locked@example.com', password: 'wrongpass' });
    expect(res.status).toBe(429);
  });

  it('clears attempts on successful login', async () => {
    await createUser('clear@example.com', 'correctpass', 'clear');

    const fail1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'clear@example.com', password: 'wrongpass' });
    expect(fail1.status).toBe(401);

    const success = await request(app)
      .post('/api/auth/login')
      .send({ email: 'clear@example.com', password: 'correctpass' });
    expect(success.status).toBe(200);
    expect(success.body.token).toBeDefined();

    const attempts = getDb()
      .prepare('SELECT * FROM login_attempts WHERE email = ?')
      .get('clear@example.com');
    expect(attempts).toBeUndefined();
  });

  it('does not lock a different account', async () => {
    await createUser('user-a@example.com', 'passA', 'userA');
    await createUser('user-b@example.com', 'passB', 'userB');

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'user-a@example.com', password: 'wrongpass' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user-b@example.com', password: 'passB' });
    expect(res.status).toBe(200);
  });

  it('resets failed_count after lockout expires (no perpetual lockout)', async () => {
    await createUser('expire@example.com', 'correctpass', 'expire');

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'expire@example.com', password: 'wrongpass' });
    }

    const rowBefore = getDb()
      .prepare('SELECT failed_count, locked_until FROM login_attempts WHERE email = ?')
      .get('expire@example.com') as { failed_count: number; locked_until: string };
    expect(rowBefore.failed_count).toBe(5);
    expect(rowBefore.locked_until).not.toBeNull();

    getDb()
      .prepare('UPDATE login_attempts SET locked_until = ? WHERE email = ?')
      .run(new Date(Date.now() - 60_000).toISOString(), 'expire@example.com');

    const locked = isAccountLocked('expire@example.com');
    expect(locked.locked).toBe(false);

    const rowAfter = getDb()
      .prepare('SELECT failed_count FROM login_attempts WHERE email = ?')
      .get('expire@example.com') as { failed_count: number };
    expect(rowAfter.failed_count).toBe(0);

    const singleFail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'expire@example.com', password: 'wrongpass' });
    expect(singleFail.status).toBe(401);
  });
});

describe('HttpOnly cookie auth (ZEMA-3283)', () => {
  let protectedApp: express.Application;
  let authApp: express.Application;

  beforeAll(() => {
    initDb();
    protectedApp = createTestApp();
    authApp = createAuthApp();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM users').run();
    getDb().prepare('DELETE FROM login_attempts').run();
  });

  it('authMiddleware accepts a valid token sent via HttpOnly cookie (200)', async () => {
    const user = (await createUser('cookie@example.com', 'password123', 'cookieuser'))!;
    const token = jwt.sign({ user_id: user.id }, config.jwtSecret, { expiresIn: '7d' });
    const res = await request(protectedApp)
      .get('/protected')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(user.id);
  });

  it('login sets an HttpOnly auth cookie containing a valid token', async () => {
    await createUser('cookielogin@example.com', 'correctpass', 'cookielogin');
    const res = await request(authApp)
      .post('/api/auth/login')
      .send({ email: 'cookielogin@example.com', password: 'correctpass' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    expect(cookieStr).toMatch(/token=/);
    expect(cookieStr.toLowerCase()).toContain('httponly');
    expect(cookieStr.toLowerCase()).toContain('samesite=strict');
    const tokenMatch = cookieStr.match(/token=([^;]+)/);
    expect(tokenMatch).not.toBeNull();
    const decoded = jwt.verify(tokenMatch![1], config.jwtSecret) as { user_id: string };
    expect(decoded.user_id).toBeDefined();
  });

  it('logout clears the auth cookie', async () => {
    const res = await request(authApp).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    expect(cookieStr).toMatch(/token=;/);
  });
});

describe('OAuth callback error handling (ZEMA-3416)', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createAuthApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('missing code parameter — redirects with error', async () => {
    const res = await request(app).get('/api/auth/oauth/callback/kakao');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=missing_code');
  });

  it('invalid provider — redirects with error', async () => {
    const res = await request(app).get('/api/auth/oauth/callback/facebook?code=test');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=invalid_provider');
  });

  it('kakao without configured credentials — redirects with not_configured', async () => {
    const origKakaoId = config.kakaoClientId;
    const origKakaoUri = config.kakaoRedirectUri;
    config.kakaoClientId = '';
    config.kakaoRedirectUri = '';

    const res = await request(app)
      .get('/api/auth/oauth/callback/kakao?code=test&state=test-state')
      .set('Cookie', 'kakao_oauth_state=test-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=not_configured');

    config.kakaoClientId = origKakaoId;
    config.kakaoRedirectUri = origKakaoUri;
  });

  it('kakao state mismatch — redirects with state_mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/callback/kakao?code=test&state=wrong-state')
      .set('Cookie', 'kakao_oauth_state=correct-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=state_mismatch');
  });

  it('kakao missing state — redirects with state_mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/callback/kakao?code=test');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=state_mismatch');
  });

  it('naver state mismatch — redirects with state_mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/callback/naver?code=test&state=wrong-state')
      .set('Cookie', 'naver_oauth_state=correct-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=state_mismatch');
  });

  it('google without configured credentials — redirects with not_configured', async () => {
    const origGoogleId = config.googleClientId;
    const origGoogleUri = config.googleRedirectUri;
    config.googleClientId = '';
    config.googleRedirectUri = '';

    const res = await request(app)
      .get('/api/auth/oauth/callback/google?code=test&state=test-state')
      .set('Cookie', 'google_oauth_state=test-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=not_configured');

    config.googleClientId = origGoogleId;
    config.googleRedirectUri = origGoogleUri;
  });

  it('google state mismatch — redirects with state_mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/callback/google?code=test&state=wrong-state')
      .set('Cookie', 'google_oauth_state=correct-state');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=state_mismatch');
  });

  it('google missing state — redirects with state_mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/callback/google?code=test');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_error=state_mismatch');
  });
});

describe('OAuth callback success redirect — no identity leak (ZEMA-3445)', () => {
  let app: express.Application;
  const origFetch = global.fetch;

  beforeAll(() => {
    initDb();
    app = createAuthApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
    config.googleClientId = 'test-google-id';
    config.googleClientSecret = 'test-google-secret';
    config.googleRedirectUri = 'https://example.com/api/auth/oauth/callback/google';
  });

  afterEach(() => {
    global.fetch = origFetch;
    config.googleClientId = '';
    config.googleRedirectUri = '';
  });

  it('success redirect URL is exactly /login?oauth=1 — no user_id or nickname', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          email: 'oauth-user@example.com',
          name: '오오쓰유저',
          id: 'google-profile-42',
        }),
      });
    }) as typeof fetch;

    const res = await request(app)
      .get('/api/auth/oauth/callback/google?code=test-code&state=test-state')
      .set('Cookie', 'google_oauth_state=test-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth=1');
    expect(res.headers.location).not.toMatch(/user_id/i);
    expect(res.headers.location).not.toMatch(/nickname/i);
    expect(res.headers.location).not.toContain('google-profile-42');
    expect(res.headers.location).not.toContain('oauth-user');
  });

  it('success redirect sets HttpOnly auth cookie', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          email: 'cookie-test@example.com',
          name: '쿠키냥',
          id: 'google-cookie-99',
        }),
      });
    }) as typeof fetch;

    const res = await request(app)
      .get('/api/auth/oauth/callback/google?code=test-code&state=test-state')
      .set('Cookie', 'google_oauth_state=test-state');

    expect(res.status).toBe(302);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    expect(cookieStr).toMatch(/httponly/i);
  });
});
