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

function naverTokenResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('GET /oauth/naver/callback', () => {
  let app: express.Application;
  let fetchMock: jest.SpyInstance;
  const originalClientId = config.naverClientId;
  const originalClientSecret = config.naverClientSecret;
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
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  afterAll(() => {
    config.naverClientId = originalClientId;
    config.naverClientSecret = originalClientSecret;
  });

  it('rejects request without naver_oauth_state cookie (401)', async () => {
    const res = await request(app)
      .get(`/oauth/naver/callback?code=abc&state=${STATE}`);
    expect(res.status).toBe(401);
    expect(res.body.detail).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects state mismatch between cookie and query param (401) and invalidates cookie', async () => {
    const res = await request(app)
      .get(`/oauth/naver/callback?code=abc&state=attacker-forge-state`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toContain('naver_oauth_state=;');
    expect(setCookie).toContain('Thu, 01 Jan 1970');
  });

  it('rejects missing state query param even with valid cookie (401)', async () => {
    const res = await request(app)
      .get(`/oauth/naver/callback?code=abc`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cancelled login (no code) with valid state (401)', async () => {
    const res = await request(app)
      .get(`/oauth/naver/callback?error=access_denied&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when naver client credentials are not configured', async () => {
    config.naverClientId = '';
    config.naverClientSecret = '';
    const res = await request(app)
      .get(`/oauth/naver/callback?code=abc&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges code, creates naver user, and redirects to /login landing (302)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        naverTokenResponse({ access_token: 'naver-access-token', token_type: 'bearer' })
      )
      .mockResolvedValueOnce(
        naverTokenResponse({
          resultcode: '00',
          message: 'success',
          response: { id: 'naver-777', email: 'naver-user@test.com', nickname: '네이버러' },
        })
      );

    const res = await request(app)
      .get(`/oauth/naver/callback?code=auth-code-123&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(302);

    // 토큰 교환 요청 검증
    const tokenCallUrl = String(fetchMock.mock.calls[0][0]);
    expect(tokenCallUrl).toContain('https://nid.naver.com/oauth2.0/token');
    expect(tokenCallUrl).toContain('grant_type=authorization_code');
    expect(tokenCallUrl).toContain('code=auth-code-123');
    expect(tokenCallUrl).toContain(`state=${STATE}`);

    // 프로필 요청 검증
    const profileCall = fetchMock.mock.calls[1];
    expect(String(profileCall[0])).toBe('https://openapi.naver.com/v1/nid/me');
    expect((profileCall[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer naver-access-token',
    });

    // 리다이렉트 위치 검증 — /login?oauth=1&token=...&user_id=...&nickname=...
    const location = new URL(res.headers.location);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('oauth')).toBe('1');
    const token = location.searchParams.get('token');
    const userId = location.searchParams.get('user_id');
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();
    expect(location.searchParams.get('nickname')).toBe('네이버러');
    const payload = jwt.verify(token!, config.jwtSecret) as { user_id: string };
    expect(payload.user_id).toBe(userId);

    // 사용자 생성 검증 (provider=naver)
    const user = getUserById(userId!);
    expect(user).toBeDefined();
    expect(user!.provider).toBe('naver');
    expect(user!.provider_id).toBe('naver-777');
    expect(user!.email).toBe('naver-user@test.com');

    // 일회용 state 쿠키 삭제 검증
    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toContain('naver_oauth_state=;');
    expect(setCookie).toContain('Thu, 01 Jan 1970');
  });

  it('returns 502 when naver token exchange fails', async () => {
    fetchMock.mockResolvedValueOnce(naverTokenResponse({ error: 'invalid_request' }, false, 400));

    const res = await request(app)
      .get(`/oauth/naver/callback?code=bad-code&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(502);
    expect(res.body.detail).toBeDefined();
  });

  it('returns 502 when naver profile response has no id', async () => {
    fetchMock
      .mockResolvedValueOnce(naverTokenResponse({ access_token: 't' }))
      .mockResolvedValueOnce(
        naverTokenResponse({ resultcode: '00', message: 'success', response: { nickname: 'id없음' } })
      );

    const res = await request(app)
      .get(`/oauth/naver/callback?code=code-x&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);

    expect(res.status).toBe(502);
    expect(res.body.detail).toBeDefined();
  });

  it('second callback attempt after cookie deletion is rejected (one-time cookie semantics)', async () => {
    fetchMock
      .mockResolvedValueOnce(naverTokenResponse({ access_token: 't' }))
      .mockResolvedValueOnce(
        naverTokenResponse({
          resultcode: '00',
          message: 'success',
          response: { id: 'naver-999', nickname: '일회용' },
        })
      );

    const first = await request(app)
      .get(`/oauth/naver/callback?code=code-1&state=${STATE}`)
      .set('Cookie', [`naver_oauth_state=${STATE}`]);
    expect(first.status).toBe(302);

    // 브라우저는 첫 응답의 Set-Cookie 삭제를 적용 → 재시도 시 쿠키 없음 → 401
    const second = await request(app)
      .get(`/oauth/naver/callback?code=code-2&state=${STATE}`);
    expect(second.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
