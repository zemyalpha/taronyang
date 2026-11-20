import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authRouter } from '../routes/auth';
import { initDb, getUserById } from '../database';
import { config } from '../config';

function createTestApp() {
  const app = express();
  app.use(cookieParser());
  app.use(authRouter);
  return app;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('GET /oauth/callback/:provider (GitHub #296)', () => {
  let app: express.Application;
  let fetchMock: jest.SpyInstance;
  const originals = {
    naverClientId: config.naverClientId,
    naverClientSecret: config.naverClientSecret,
    naverRedirectUri: config.naverRedirectUri,
    kakaoClientId: config.kakaoClientId,
    kakaoClientSecret: config.kakaoClientSecret,
    kakaoRedirectUri: config.kakaoRedirectUri,
  };
  const STATE = '11111111-2222-3333-4444-555555555555';

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const { getDb } = require('../database');
    getDb().prepare('DELETE FROM users').run();
    config.naverClientId = 'test-naver-client-id';
    config.naverClientSecret = 'test-naver-client-secret';
    config.naverRedirectUri = 'http://localhost:8000/api/auth/oauth/callback/naver';
    config.kakaoClientId = 'test-kakao-client-id';
    config.kakaoClientSecret = 'test-kakao-client-secret';
    config.kakaoRedirectUri = 'http://localhost:8000/api/auth/oauth/callback/kakao';
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  afterAll(() => {
    Object.assign(config, originals);
  });

  it('rejects an unknown provider', async () => {
    const res = await request(app).get('/oauth/callback/github?code=abc&state=x');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=invalid_provider');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects request without state cookie (state_mismatch) and invalidates nothing', async () => {
    const res = await request(app)
      .get(`/oauth/callback/naver?code=abc&state=${STATE}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects state mismatch between cookie and query param and clears the one-time cookie', async () => {
    const res = await request(app)
      .get(`/oauth/callback/naver?code=abc&state=attacker-forge-state`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookies.find((c: string) => /naver_oauth_state=;/.test(c));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Thu, 01 Jan 1970/);
  });

  it('rejects missing state query param even with a valid cookie', async () => {
    const res = await request(app)
      .get(`/oauth/callback/naver?code=abc`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to cancelled when the provider reports an error (user cancelled)', async () => {
    const res = await request(app)
      .get(`/oauth/callback/naver?error=access_denied&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to missing_code when no code is present with valid state', async () => {
    const res = await request(app)
      .get(`/oauth/callback/naver?state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=missing_code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to not_configured when provider credentials are missing', async () => {
    config.naverClientId = '';
    config.naverClientSecret = '';
    const res = await request(app)
      .get(`/oauth/callback/naver?code=abc&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges the code, sets an HttpOnly cookie, and redirects WITHOUT a token in the URL (naver)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'naver-access-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse({
        resultcode: '00',
        message: 'success',
        response: { id: 'naver-777', email: 'naver-user@test.com', nickname: '네이버러' },
      }));

    const res = await request(app)
      .get(`/oauth/callback/naver?code=auth-code-123&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(302);

    // 리다이렉트 위치 — 토큰/개인정보가 URL에 절대 없어야 함 (GitHub #296 핵심)
    const location = new URL(res.headers.location as string, 'http://localhost:8000');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('oauth')).toBe('1');
    expect(location.searchParams.get('token')).toBeNull();
    expect(location.searchParams.get('user_id')).toBeNull();
    expect(location.searchParams.get('nickname')).toBeNull();

    // 토큰 교환 요청 검증
    const tokenCall = fetchMock.mock.calls[0];
    expect(String(tokenCall[0])).toBe('https://nid.naver.com/oauth2.0/token');
    const tokenBody = String((tokenCall[1] as RequestInit).body);
    expect(tokenBody).toContain('grant_type=authorization_code');
    expect(tokenBody).toContain('code=auth-code-123');
    expect(tokenBody).toContain(`state=${encodeURIComponent(STATE)}`);

    // 프로필 요청 검증
    const profileCall = fetchMock.mock.calls[1];
    expect(String(profileCall[0])).toBe('https://openapi.naver.com/v1/nid/me');
    expect((profileCall[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer naver-access-token',
    });

    // HttpOnly 인증 쿠키 검증
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = setCookies.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
    expect(tokenCookie).toMatch(/Path=\//);
    const cookieToken = tokenCookie!.split(';')[0].replace('token=', '');
    const payload = jwt.verify(cookieToken, config.jwtSecret) as { user_id: string };

    // 사용자 생성 검증 (provider=naver)
    const user = getUserById(payload.user_id);
    expect(user).toBeDefined();
    expect(user!.provider).toBe('naver');
    expect(user!.provider_id).toBe('naver-777');
    expect(user!.email).toBe('naver-user@test.com');

    // 일회용 state 쿠키 삭제 검증
    const cleared = setCookies.find((c: string) => /naver_oauth_state=;/.test(c));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Thu, 01 Jan 1970/);
  });

  it('creates a kakao user via the unified callback and sets the HttpOnly cookie', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'kakao-access-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse({
        id: 98765,
        kakao_account: { email: 'kakao-user@test.com', profile: { nickname: '카카오러' } },
      }));

    const res = await request(app)
      .get(`/oauth/callback/kakao?code=kakao-code&state=${STATE}`)
      .set('Cookie', [`kakao_oauth_state=${STATE}`]);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location as string, 'http://localhost:8000');
    expect(location.searchParams.get('oauth')).toBe('1');
    expect(location.searchParams.get('token')).toBeNull();

    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = setCookies.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toMatch(/HttpOnly/i);
    const payload = jwt.verify(tokenCookie!.split(';')[0].replace('token=', ''), config.jwtSecret) as { user_id: string };

    const user = getUserById(payload.user_id);
    expect(user!.provider).toBe('kakao');
    expect(user!.provider_id).toBe('98765');
    expect(user!.email).toBe('kakao-user@test.com');
  });

  it('redirects to server_error when token exchange fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, false, 400));

    const res = await request(app)
      .get(`/oauth/callback/naver?code=bad-code&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=server_error');
  });

  it('redirects to incomplete_profile when the profile has no provider id', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 't' }))
      .mockResolvedValueOnce(jsonResponse({
        resultcode: '00',
        message: 'success',
        response: { nickname: 'id없음' },
      }));

    const res = await request(app)
      .get(`/oauth/callback/naver?code=code-x&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?oauth_error=incomplete_profile');
  });

  it('rejects a second callback attempt after the one-time state cookie was consumed', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 't' }))
      .mockResolvedValueOnce(jsonResponse({
        resultcode: '00',
        message: 'success',
        response: { id: 'naver-999', nickname: '일회용' },
      }));

    const first = await request(app)
      .get(`/oauth/callback/naver?code=code-1&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(first.status).toBe(302);

    // 브라우저는 첫 응답의 Set-Cookie 삭제를 적용 → 재시도 시 쿠키 없음 → state_mismatch
    const second = await request(app)
      .get(`/oauth/callback/naver?code=code-2&state=${STATE}`);
    expect(second.status).toBe(302);
    expect(second.headers.location).toBe('/login?oauth_error=state_mismatch');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GET /oauth/urls (GitHub #296)', () => {
  let app: express.Application;
  const originals = {
    naverClientId: config.naverClientId,
    kakaoClientId: config.kakaoClientId,
    googleClientId: config.googleClientId,
  };

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  afterAll(() => {
    Object.assign(config, originals);
  });

  it('issues per-provider state cookies and embeds state in the authorize URLs', async () => {
    config.naverClientId = 'test-naver-client-id';
    config.kakaoClientId = 'test-kakao-client-id';
    const res = await request(app).get('/oauth/urls');
    expect(res.status).toBe(200);

    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const naverStateCookie = setCookies.find((c: string) => c.startsWith('naver_oauth_state='));
    const kakaoStateCookie = setCookies.find((c: string) => c.startsWith('kakao_oauth_state='));
    expect(naverStateCookie).toMatch(/HttpOnly/i);
    expect(kakaoStateCookie).toMatch(/HttpOnly/i);

    const naverState = naverStateCookie!.split(';')[0].replace('naver_oauth_state=', '');
    const kakaoState = kakaoStateCookie!.split(';')[0].replace('kakao_oauth_state=', '');
    expect(naverState).not.toBe(kakaoState);

    expect(res.body.naver).toContain(`state=${naverState}`);
    expect(res.body.kakao).toContain(`state=${kakaoState}`);
    // 하드코딩 state 금지 (이전 state=taronyang 회귀 방지)
    expect(res.body.naver).not.toContain('state=taronyang');
  });

  it('omits providers that are not configured', async () => {
    config.naverClientId = '';
    config.kakaoClientId = '';
    config.googleClientId = '';
    const res = await request(app).get('/oauth/urls');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
