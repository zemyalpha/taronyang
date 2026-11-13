/** 인증 API 라우터 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { createUser, verifyUser, getUserById, getUserByEmail, findOrCreateOAuthUser, getDb, User } from '../database';
import { signupSchema, loginSchema, updateMeSchema } from '../validation';
import { logger } from '../logger';

export const authRouter = Router();

// --- 타입 ---

interface TokenPayload {
  user_id: string;
}

// --- 미들웨어 ---

/** JWT에서 현재 사용자 추출 — Authorization 헤더 또는 HttpOnly 쿠키 (GitHub #296) */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  let token: string | undefined;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (typeof req.cookies?.token === 'string') {
    token = req.cookies.token;
  }
  if (!token) {
    res.status(401).json({ detail: '로그인이 필요합니다' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    const user = getUserById(payload.user_id);
    if (!user) {
      res.status(401).json({ detail: '사용자를 찾을 수 없습니다' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ detail: '토큰이 만료되었거나 유효하지 않습니다' });
  }
}

/** 관리자 권한 확인 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user?.is_admin) {
    res.status(403).json({ detail: '관리자 권한이 필요합니다' });
    return;
  }
  next();
}

function createToken(userId: string): string {
  return jwt.sign({ user_id: userId } as TokenPayload, config.jwtSecret, { expiresIn: `${config.jwtExpireDays}d` });
}

/** JWT를 HttpOnly 쿠키로 설정 (GitHub #296 — URL query param 토큰 유출 방지) */
function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.cookieSameSite,
    maxAge: config.jwtExpireDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/** OAuth state 쿠키 옵션 — /oauth/urls 세팅 시 콜백 삭제 시 동일하게 유지 */
const stateCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
};

/** 문자열 타이밍 세이프 비교 (길이 다르면 즉시 불일치) */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function makeUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    provider: user.provider,
    subscription_status: user.subscription_status,
  };
}

// --- 엔드포인트 ---

/** 회원가입 */
authRouter.post('/signup', (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { email, password, nickname } = parsed.data;

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ detail: '이미 가입된 이메일입니다' });
    return;
  }

  const user = createUser(email, password, nickname);
  if (!user) {
    res.status(500).json({ detail: '회원가입에 실패했습니다' });
    return;
  }

  const token = createToken(user.id);
  setAuthCookie(res, token);
  res.json({ token, user: makeUserResponse(user) });
});

/** 로그인 */
authRouter.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { email, password } = parsed.data;
  const user = verifyUser(email, password);
  if (!user) {
    res.status(401).json({ detail: '이메일 또는 비밀번호가 일치하지 않습니다' });
    return;
  }
  const token = createToken(user.id);
  setAuthCookie(res, token);
  res.json({ token, user: makeUserResponse(user) });
});

/** 로그아웃 — HttpOnly 인증 쿠키 삭제 (GitHub #296) */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.cookieSameSite,
    path: '/',
  });
  res.json({ ok: true });
});

/** 내 정보 조회 */
authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = req.user!;
  res.json(makeUserResponse(user));
});

/** 내 정보 수정 */
authRouter.put('/me', authMiddleware, (req: Request, res: Response) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }

  const user = req.user!;
  const { nickname, birth_date } = parsed.data;

  const db = getDb();
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (nickname !== undefined) {
    updates.push('nickname = ?');
    params.push(nickname);
  }
  if (birth_date !== undefined) {
    updates.push('birth_date = ?');
    params.push(birth_date);
    const zodiac = birth_date ? calcZodiac(birth_date) : null;
    updates.push('zodiac_sign = ?');
    params.push(zodiac);
  }
  if (updates.length > 0) {
    params.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = getUserById(user.id);
  res.json(makeUserResponse(updated!));
});

/** 소셜 로그인 URL 목록 — 프로바이더별 CSRF state를 httpOnly 쿠키로 발급 (GitHub #296) */
authRouter.get('/oauth/urls', (_req: Request, res: Response) => {
  const urls: Record<string, string> = {};
  if (config.kakaoClientId) {
    const state = crypto.randomUUID();
    res.cookie('kakao_oauth_state', state, { ...stateCookieOptions, maxAge: 15 * 60 * 1000 });
    urls.kakao = `https://kauth.kakao.com/oauth/authorize?client_id=${config.kakaoClientId}&redirect_uri=${config.kakaoRedirectUri}&response_type=code&scope=profile_nickname,account_email&state=${state}`;
  }
  if (config.naverClientId) {
    const state = crypto.randomUUID();
    res.cookie('naver_oauth_state', state, { ...stateCookieOptions, maxAge: 15 * 60 * 1000 });
    urls.naver = `https://nid.naver.com/oauth2.0/authorize?client_id=${config.naverClientId}&redirect_uri=${config.naverRedirectUri}&response_type=code&state=${state}`;
  }
  if (config.googleClientId) {
    const state = crypto.randomUUID();
    res.cookie('google_oauth_state', state, { ...stateCookieOptions, maxAge: 15 * 60 * 1000 });
    const scope = encodeURIComponent('openid email profile');
    urls.google = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}&redirect_uri=${config.googleRedirectUri}&response_type=code&scope=${scope}&access_type=offline&state=${state}`;
  }
  res.json(urls);
});

/** 소셜 로그인 콜백 — 인증 코드 교환 후 HttpOnly 쿠키로 세션 발급 (GitHub #296)
 *
 * 보안: JWT를 리다이렉트 URL query param에 넣지 않는다 (브라우저 히스토리/Referrer/액세스 로그 유출 방지).
 * 성공 시: HttpOnly 쿠키 설정 + /login?oauth=1 로 리다이렉트 (토큰·개인정보 미포함)
 * 실패 시: /login?oauth_error=<code> 로 리다이렉트
 */
authRouter.get('/oauth/callback/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const validProviders = ['kakao', 'naver', 'google'];
  if (!validProviders.includes(provider)) {
    res.redirect('/login?oauth_error=invalid_provider');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';
  const stateCookieName = `${provider}_oauth_state`;
  const stateFromCookie = typeof req.cookies?.[stateCookieName] === 'string'
    ? req.cookies[stateCookieName] as string
    : '';

  // state 쿠키는 일회용 — 검증 결과와 무관하게 즉시 무효화
  res.clearCookie(stateCookieName, stateCookieOptions);

  // 사용자가 프로바이더에서 취소한 경우
  if (providerError) {
    res.redirect('/login?oauth_error=cancelled');
    return;
  }
  if (!code) {
    res.redirect('/login?oauth_error=missing_code');
    return;
  }
  // CSRF 검증: /oauth/urls가 세팅한 httpOnly 쿠키와 state 파라미터 비교
  if (!stateFromCookie || !state || !timingSafeEqualStr(stateFromCookie, state)) {
    logger.warn('OAuth state 검증 실패', { provider });
    res.redirect('/login?oauth_error=state_mismatch');
    return;
  }

  let tokenUrl: string;
  let tokenBody: Record<string, string>;
  let userInfoUrl: string;
  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;

  if (provider === 'kakao') {
    clientId = config.kakaoClientId;
    clientSecret = config.kakaoClientSecret;
    redirectUri = config.kakaoRedirectUri;
    tokenUrl = 'https://kauth.kakao.com/oauth/token';
    tokenBody = { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code };
    userInfoUrl = 'https://kapi.kakao.com/v2/user/me';
  } else if (provider === 'naver') {
    clientId = config.naverClientId;
    clientSecret = config.naverClientSecret;
    redirectUri = config.naverRedirectUri;
    tokenUrl = 'https://nid.naver.com/oauth2.0/token';
    tokenBody = { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code, state };
    userInfoUrl = 'https://openapi.naver.com/v1/nid/me';
  } else {
    clientId = config.googleClientId;
    clientSecret = config.googleClientSecret;
    redirectUri = config.googleRedirectUri;
    tokenUrl = 'https://oauth2.googleapis.com/token';
    tokenBody = { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code };
    userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
  }

  if (!clientId || !clientSecret || !redirectUri) {
    logger.error('OAuth 설정 누락', { provider });
    res.redirect('/login?oauth_error=not_configured');
    return;
  }

  try {
    // 1) Authorization Code → Access Token 교환 (10초 타임아웃)
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000);
    let accessToken: string;
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenBody).toString(),
        signal: tokenController.signal,
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        throw new Error(`token exchange failed: ${tokenData.error || 'access_token missing'}`);
      }
      accessToken = tokenData.access_token;
    } finally {
      clearTimeout(tokenTimeout);
    }

    // 2) 사용자 프로필 조회 (10초 타임아웃)
    const userController = new AbortController();
    const userTimeout = setTimeout(() => userController.abort(), 10000);
    let email: string | undefined;
    let nickname: string | undefined;
    let providerId: string | undefined;
    try {
      const profileRes = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: userController.signal,
      });
      const profile = await profileRes.json() as Record<string, unknown>;

      if (provider === 'kakao') {
        const kakaoAccount = profile.kakao_account as { email?: string; profile?: { nickname?: string } } | undefined;
        email = kakaoAccount?.email;
        nickname = kakaoAccount?.profile?.nickname;
        providerId = String(profile.id || '');
      } else if (provider === 'naver') {
        const naverResponse = profile.response as { email?: string; nickname?: string; name?: string; id?: string } | undefined;
        email = naverResponse?.email;
        nickname = naverResponse?.nickname || naverResponse?.name;
        providerId = String(naverResponse?.id || '');
      } else {
        email = profile.email as string | undefined;
        nickname = profile.name as string | undefined;
        providerId = String(profile.id || '');
      }
    } finally {
      clearTimeout(userTimeout);
    }

    if (!email || !providerId) {
      res.redirect('/login?oauth_error=incomplete_profile');
      return;
    }

    // 3) 사용자 생성/조회 후 HttpOnly 쿠키 발급 + /login?oauth=1 랜딩 (토큰 미포함)
    const user = findOrCreateOAuthUser({ provider, provider_id: providerId, email, nickname });
    setAuthCookie(res, createToken(user.id));

    res.redirect('/login?oauth=1');
  } catch (err) {
    logger.error('OAuth 콜백 처리 실패', { provider, message: err instanceof Error ? err.message : String(err) });
    res.redirect('/login?oauth_error=server_error');
  }
});

/** 생일로 별자리 계산 */
function calcZodiac(birthDate: string): string | null {
  try {
    const parts = birthDate.split('-');
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
      return '양자리';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
      return '황소자리';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 21))
      return '쌍둥이자리';
    if ((month === 6 && day >= 22) || (month === 7 && day <= 22))
      return '게자리';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
      return '사자자리';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 23))
      return '처녀자리';
    if ((month === 9 && day >= 24) || (month === 10 && day <= 22))
      return '천칭자리';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 22))
      return '전갈자리';
    if ((month === 11 && day >= 23) || (month === 12 && day <= 24))
      return '사수자리';
    if ((month === 12 && day >= 25) || (month === 1 && day <= 19))
      return '염소자리';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
      return '물병자리';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
      return '물고기자리';
  } catch {
    // 무시
  }
  return null;
}
