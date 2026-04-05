/** 인증 API 라우터 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createUser, verifyUser, getUserById, getUserByEmail, findOrCreateOAuthUser, User } from '../database';

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
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ detail: '토큰이 만료되었거나 유효하지 않습니다' });
  }
}

/** 관리자 권한 확인 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as User;
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
  const { email, password, nickname } = req.body;
  if (!email || !password) {
    res.status(400).json({ detail: '이메일과 비밀번호를 입력해주세요' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ detail: '비밀번호는 6자 이상이어야 합니다' });
    return;
  }

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
  const { email, password } = req.body;
  const user = verifyUser(email, password);
  if (!user) {
    res.status(401).json({ detail: '이메일 또는 비밀번호가 일치하지 않습니다' });
    return;
  }
  res.json({ token: createToken(user.id), user: makeUserResponse(user) });
});

/** 내 정보 조회 */
authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  res.json(makeUserResponse(user));
});

/** 내 정보 수정 */
authRouter.put('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { nickname, birth_date } = req.body;

/** 내 정보 수정 */
authRouter.put('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { nickname, birth_date } = req.body;

  const db = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (nickname) {
    updates.push('nickname = ?');
    params.push(nickname);
  }
  if (birth_date) {
    updates.push('birth_date = ?');
    params.push(birth_date);
    const zodiac = calcZodiac(birth_date);
    if (zodiac) {
      updates.push('zodiac_sign = ?');
      params.push(zodiac);
    }
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
      return '궁수자리';
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
