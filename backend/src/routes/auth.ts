/** 인증 API 라우터 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { createUser, verifyUser, getUserById, getUserByEmail, getDb, findOrCreateOAuthUser, User } from '../database';
import { signupSchema, loginSchema, updateMeSchema } from '../validation';
import { logger } from '../logger';

export const authRouter = Router();

// --- 타입 ---

interface TokenPayload {
  user_id: string;
}

// --- 미들웨어 ---

/** JWT에서 현재 사용자 추출 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ detail: '로그인이 필요합니다' });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), config.jwtSecret) as TokenPayload;
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

  res.json({ token: createToken(user.id), user: makeUserResponse(user) });
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
  res.json({ token: createToken(user.id), user: makeUserResponse(user) });
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

/** 소셜 로그인 URL 목록 */
authRouter.get('/oauth/urls', (_req: Request, res: Response) => {
  const urls: Record<string, string> = {};
  if (config.kakaoClientId) {
    urls.kakao = `https://kauth.kakao.com/oauth/authorize?client_id=${config.kakaoClientId}&redirect_uri=${config.kakaoRedirectUri}&response_type=code&scope=profile_nickname,account_email`;
  }
  if (config.naverClientId) {
    urls.naver = `https://nid.naver.com/oauth2.0/authorize?client_id=${config.naverClientId}&redirect_uri=${config.naverRedirectUri}&response_type=code&state=taronyang`;
  }
  if (config.googleClientId) {
    const scope = encodeURIComponent('openid email profile');
    urls.google = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}&redirect_uri=${config.googleRedirectUri}&response_type=code&scope=${scope}&access_type=offline`;
  }
  res.json(urls);
});

// --- 네이버 OAuth 콜백 (ZEMA-4743) ---

/** naver_oauth_state 쿠키 옵션 — /oauth/urls에서 세팅할 때와 동일하게 유지 */
const naverStateCookieOptions = {
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

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface NaverProfileResponse {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    nickname?: string;
  };
}

/** 네이버 OAuth 콜백 — CSRF state 검증 후 토큰 교환 및 로그인 처리 */
authRouter.get('/oauth/naver/callback', async (req: Request, res: Response) => {
  const stateFromCookie = req.cookies?.naver_oauth_state as string | undefined;
  const stateFromQuery = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  // state 쿠키는 일회용 — 검증 결과와 무관하게 즉시 무효화
  res.clearCookie('naver_oauth_state', naverStateCookieOptions);

  // CSRF 검증: /oauth/urls가 세팅한 httpOnly 쿠키와 state 파라미터 비교
  if (!stateFromCookie || !stateFromQuery || !timingSafeEqualStr(stateFromCookie, stateFromQuery)) {
    res.status(401).json({ detail: '유효하지 않은 로그인 요청입니다. 다시 시도해주세요.' });
    return;
  }

  // 네이버 사용자가 취소했거나 code가 없는 경우
  if (!code) {
    res.status(401).json({ detail: '네이버 로그인이 취소되었습니다.' });
    return;
  }

  if (!config.naverClientId || !config.naverClientSecret) {
    logger.error('네이버 OAuth 설정 누락 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)');
    res.status(503).json({ detail: '네이버 로그인이 서버에 설정되지 않았습니다.' });
    return;
  }

  try {
    // 1) Authorization Code → Access Token 교환
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('client_id', config.naverClientId);
    tokenUrl.searchParams.set('client_secret', config.naverClientSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('state', stateFromQuery);

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      throw new Error(`naver token exchange failed: HTTP ${tokenRes.status}`);
    }
    const tokenJson = (await tokenRes.json()) as NaverTokenResponse;
    if (!tokenJson.access_token) {
      throw new Error(`naver token exchange failed: ${tokenJson.error || 'access_token missing'}`);
    }

    // 2) 사용자 프로필 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`naver profile fetch failed: HTTP ${profileRes.status}`);
    }
    const profileJson = (await profileRes.json()) as NaverProfileResponse;
    const naverId = profileJson.response?.id;
    if (!naverId) {
      throw new Error('naver profile response missing id');
    }

    // 3) 사용자 생성/조회 후 프론트엔드 로그인 랜딩(/login?oauth=1)으로 리다이렉트
    const user = findOrCreateOAuthUser({
      provider: 'naver',
      provider_id: naverId,
      email: profileJson.response?.email,
      nickname: profileJson.response?.nickname,
    });

    const redirect = new URL('/login', config.frontendUrl);
    redirect.searchParams.set('oauth', '1');
    redirect.searchParams.set('token', createToken(user.id));
    redirect.searchParams.set('user_id', user.id);
    redirect.searchParams.set('nickname', user.nickname ?? '');
    res.redirect(302, redirect.toString());
  } catch (err) {
    logger.error('네이버 OAuth 콜백 처리 실패', { message: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ detail: '네이버 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.' });
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
