/** 인증 API 라우터 */
import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { createUser, verifyUser, getUserById, getUserByIdSafe, getUserByEmail, findOrCreateOAuthUser, getDb, User, isAccountLocked, recordFailedLogin, clearLoginAttempts } from '../database';
import { signupSchema, loginSchema, updateMeSchema } from '../validation';
import { logger } from '../logger';

export const authRouter = Router();

// --- 타입 ---

interface TokenPayload {
  user_id: string;
  v?: number;
}

// --- 미들웨어 ---

/** JWT에서 현재 사용자 추출 — Authorization header OR HttpOnly cookie (ZEMA-3283) */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  let token: string | undefined;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) {
    res.status(401).json({ detail: '로그인이 필요합니다' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    const user = getUserByIdSafe(payload.user_id);
    if (!user) {
      res.status(401).json({ detail: '사용자를 찾을 수 없습니다' });
      return;
    }
    if (payload.v !== undefined && payload.v !== (user as User).token_version) {
      res.status(401).json({ detail: '토큰이 무효화되었습니다' });
      return;
    }
    req.user = user as User;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.debug('JWT expired', { error: String(err) });
    } else {
      logger.warn('JWT verification failed', { error: String(err) });
    }
    res.status(401).json({ detail: '토큰이 만료되었거나 유효하지 않습니다' });
  }
}

/** 관리자 권한 확인 — ADMIN_EMAILS를 매 요청마다 실시간 재검증 (revocation 지원) */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user?.email || !config.adminEmails.includes(user.email.toLowerCase())) {
    res.status(403).json({ detail: '관리자 권한이 필요합니다' });
    return;
  }
  next();
}

function createToken(userId: string, tokenVersion?: number): string {
  const payload: TokenPayload = { user_id: userId };
  if (tokenVersion !== undefined) payload.v = tokenVersion;
  return jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.jwtExpireDays}d` });
}

/** JWT를 HttpOnly 쿠키로 설정 (ZEMA-3283 — localStorage XSS 방지) */
function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: config.jwtExpireDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function makeUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    provider: user.provider,
    subscription_status: user.subscription_status,
    zodiac_sign: user.zodiac_sign || '',
  };
}

// --- 엔드포인트 ---

/** 회원가입 */
authRouter.post('/signup', asyncHandler(async (req: Request, res: Response) => {
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

  const user = await createUser(email, password, nickname);
  if (!user) {
    if (getUserByEmail(email)) {
      res.status(409).json({ detail: '이미 가입된 이메일입니다' });
    } else {
      res.status(500).json({ detail: '회원가입에 실패했습니다' });
    }
    return;
  }

  const token = createToken(user.id, user.token_version);
  setAuthCookie(res, token);
  res.json({ token, user: makeUserResponse(user) });
  return;
}));

/** 로그인 */
authRouter.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { email, password } = parsed.data;

  const lockState = isAccountLocked(email);
  if (lockState.locked) {
    res.status(429).json({ detail: '로그인 시도 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.' });
    return;
  }

  const user = await verifyUser(email, password);
  if (!user) {
    const result = recordFailedLogin(email);
    if (result.locked) {
      res.status(429).json({ detail: '로그인 시도 횟수가 초과되었습니다. 15분 후 다시 시도해주세요.' });
      return;
    }
    res.status(401).json({ detail: '이메일 또는 비밀번호가 일치하지 않습니다' });
    return;
  }
  clearLoginAttempts(email);
  const token = createToken(user.id, user.token_version);
  setAuthCookie(res, token);
  res.json({ token, user: makeUserResponse(user) });
}));

/** 로그아웃 — HttpOnly 쿠키 삭제 (ZEMA-3283) */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
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
  if (!updated) {
    res.status(404).json({ detail: '사용자를 찾을 수 없습니다' });
    return;
  }
  res.json(makeUserResponse(updated));
});

/** 소셜 로그인 URL 목록 */
authRouter.get('/oauth/urls', (_req: Request, res: Response) => {
  const urls: Record<string, string> = {};
  if (config.kakaoClientId) {
    const state = crypto.randomUUID();
    res.cookie('kakao_oauth_state', state, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    urls.kakao = `https://kauth.kakao.com/oauth/authorize?client_id=${config.kakaoClientId}&redirect_uri=${config.kakaoRedirectUri}&response_type=code&scope=profile_nickname,account_email&state=${state}`;
  }
  if (config.naverClientId) {
    const state = crypto.randomUUID();
    res.cookie('naver_oauth_state', state, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    urls.naver = `https://nid.naver.com/oauth2.0/authorize?client_id=${config.naverClientId}&redirect_uri=${config.naverRedirectUri}&response_type=code&state=${state}`;
  }
  if (config.googleClientId) {
    const state = crypto.randomUUID();
    res.cookie('google_oauth_state', state, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    const scope = encodeURIComponent('openid email profile');
    urls.google = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}&redirect_uri=${config.googleRedirectUri}&response_type=code&scope=${scope}&access_type=offline&state=${state}`;
  }
  res.json(urls);
});

/** 소셜 로그인 콜백 — 인증 코드를 토큰으로 교환하고 사용자 생성/조회 (ZEMA-3416) */
authRouter.get('/oauth/callback/:provider', asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    res.redirect('/login?oauth_error=missing_code');
    return;
  }

  const validProviders = ['kakao', 'naver', 'google'];
  if (!validProviders.includes(provider)) {
    res.redirect('/login?oauth_error=invalid_provider');
    return;
  }

  let tokenUrl: string;
  let tokenBody: Record<string, string>;
  let userInfoUrl: string;
  let clientId: string;
  let redirectUri: string;

  if (provider === 'kakao') {
    if (!state || state !== req.cookies?.kakao_oauth_state) {
      res.redirect('/login?oauth_error=state_mismatch');
      return;
    }
    tokenUrl = 'https://kauth.kakao.com/oauth/token';
    tokenBody = {
      grant_type: 'authorization_code',
      client_id: config.kakaoClientId,
      client_secret: config.kakaoClientSecret,
      redirect_uri: config.kakaoRedirectUri,
      code,
    };
    userInfoUrl = 'https://kapi.kakao.com/v2/user/me';
    clientId = config.kakaoClientId;
    redirectUri = config.kakaoRedirectUri;
  } else if (provider === 'naver') {
    if (!state || state !== req.cookies?.naver_oauth_state) {
      res.redirect('/login?oauth_error=state_mismatch');
      return;
    }
    tokenUrl = 'https://nid.naver.com/oauth2.0/token';
    tokenBody = {
      grant_type: 'authorization_code',
      client_id: config.naverClientId,
      client_secret: config.naverClientSecret,
      redirect_uri: config.naverRedirectUri,
      code,
      state: state as string,
    };
    userInfoUrl = 'https://openapi.naver.com/v1/nid/me';
    clientId = config.naverClientId;
    redirectUri = config.naverRedirectUri;
  } else {
    if (!state || state !== req.cookies?.google_oauth_state) {
      res.redirect('/login?oauth_error=state_mismatch');
      return;
    }
    tokenUrl = 'https://oauth2.googleapis.com/token';
    tokenBody = {
      grant_type: 'authorization_code',
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      code,
    };
    userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    clientId = config.googleClientId;
    redirectUri = config.googleRedirectUri;
  }

  if (!clientId || !redirectUri) {
    res.redirect('/login?oauth_error=not_configured');
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let accessToken: string;
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenBody).toString(),
        signal: controller.signal,
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        throw new Error(`Token exchange failed: ${tokenData.error || 'unknown'}`);
      }
      accessToken = tokenData.access_token;
    } finally {
      clearTimeout(timeout);
    }

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
        const response = profile.response as { email?: string; nickname?: string; name?: string; id?: string } | undefined;
        email = response?.email;
        nickname = response?.nickname || response?.name;
        providerId = String(response?.id || '');
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

    const user = findOrCreateOAuthUser({
      provider,
      provider_id: providerId,
      email,
      nickname,
    });

    const jwtToken = createToken(user.id, user.token_version);
    setAuthCookie(res, jwtToken);

    const redirectUrl = '/login?oauth=1';
    res.redirect(redirectUrl);
  } catch (err) {
    logger.error('OAuth callback error', { provider, error: String(err) });
    res.redirect('/login?oauth_error=server_error');
  }
}));

/** 생일로 별자리 계산 */
function calcZodiac(birthDate: string): string | null {
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
  return null;
}
