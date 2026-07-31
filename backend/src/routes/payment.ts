/** 결제 API 라우터 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { config } from '../config';
import { getDb, getUserById } from '../database';
import { authMiddleware } from './auth';
import { paymentVerifySchema } from '../validation';
import { logger } from '../logger';

export const paymentRouter = Router();

/** 포트원 API 토큰 발급 (임시 구현) */
async function getPortOneToken(): Promise<string> {
  if (!config.portOneImpKey || !config.portOneImpSecret) {
    throw new Error('포트원 API 키가 설정되지 않았습니다');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://api.iamport.kr/users/getToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imp_key: config.portOneImpKey, imp_secret: config.portOneImpSecret }),
      signal: controller.signal,
    });
    const data = await res.json() as { code: number; message?: string; response?: { access_token?: string } };
    if (data.code !== 0) throw new Error(`포트원 토큰 발급 실패: ${data.message}`);
    const tokenResponse = data.response;
    if (!tokenResponse?.access_token) {
      throw new Error('포트원 토큰이 응답에 없습니다');
    }
    return tokenResponse.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Expired premium subscription auto-downgrade.
 * If the subscription has expired, updates the DB and mutates the user object.
 * Returns true if the subscription was expired (and thus downgraded).
 */
function expireIfNeeded(user: NonNullable<ReturnType<typeof getUserById>>): boolean {
  if ((user.subscription_status === 'premium' || user.subscription_status === 'cancelling') && user.subscription_expires_at) {
    if (new Date(user.subscription_expires_at) < new Date()) {
      const db = getDb();
      db.prepare("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?")
        .run(user.id);
      user.subscription_status = 'free';
      user.subscription_expires_at = null;
      return true;
    }
  }
  return false;
}

/** 요금 정보 */
paymentRouter.get('/price', (_req: Request, res: Response) => {
  res.json({ premium_price: config.premiumPrice, currency: 'KRW', interval: 'monthly' });
});

/** 결제 검증 + 프리미엄 활성화 */
paymentRouter.post('/verify', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const parsed = paymentVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { imp_uid } = parsed.data;

  // 리플레이 공격 방지 — 이미 처리된 결제인지 확인
  const db = getDb();
  const alreadyProcessed = db.prepare('SELECT 1 FROM processed_payments WHERE imp_uid = ?').get(imp_uid);
  if (alreadyProcessed) {
    res.status(400).json({ detail: '이미 처리된 결제 건입니다.' });
    return;
  }

  try {
    // 포트원 결제 검증
    const token = await getPortOneToken();
    const payController = new AbortController();
    const payTimeout = setTimeout(() => payController.abort(), 10000);
    let payRes: globalThis.Response;
    try {
      payRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: payController.signal,
      });
    } finally {
      clearTimeout(payTimeout);
    }
    const payData = await payRes.json() as { code: number; message?: string; response?: { status: string; amount: number; buyer_email?: string | null; merchant_uid?: string | null; custom_data?: { user_id?: string } | null } };
    if (payData.code !== 0) {
      res.status(400).json({ detail: `결제 조회 실패: ${payData.message}` });
      return;
    }
    const payment = payData.response;
    if (!payment || payment.status !== 'paid') {
      res.status(400).json({ detail: '결제가 완료되지 않았습니다' });
      return;
    }
    if (payment.amount !== config.premiumPrice) {
      res.status(400).json({ detail: '결제 금액이 일치하지 않습니다' });
      return;
    }
    // 결제 소유권 검증 — 요청한 사용자가 실제 결제자인지 확인 (결제 탈취/리플레이 방지)
    const paymentUserId = payment.custom_data?.user_id;
    const paymentEmail = payment.buyer_email?.toLowerCase() ?? null;
    const userEmail = req.user!.email?.toLowerCase() ?? null;
    const ownsByUserId = paymentUserId && paymentUserId === req.user!.id;
    const ownsByEmail = paymentEmail && userEmail && paymentEmail === userEmail;
    if (!ownsByUserId && !ownsByEmail) {
      logger.warn('결제 소유권 불일치', { imp_uid, user_id: req.user!.id });
      res.status(403).json({ detail: '결제 정보가 현재 사용자와 일치하지 않습니다.' });
      return;
    }

    // 프리미엄 활성화 + 결제 기록 (원자적 트랜잭션 — TOCTOU 방지)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = db.transaction(() => {
      const insertResult = db.prepare(
        'INSERT OR IGNORE INTO processed_payments (imp_uid, user_id, amount) VALUES (?, ?, ?)'
      ).run(imp_uid, req.user!.id, payment.amount);
      if (insertResult.changes === 0) {
        return null;
      }
      db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
        .run(expires, req.user!.id);
      return insertResult;
    })();

    if (!result) {
      res.status(400).json({ detail: '이미 처리된 결제 건입니다.' });
      return;
    }

    res.json({ ok: true, message: '프리미엄이 활성화되었습니다! ✨' });
  } catch (err: unknown) {
    logger.error('결제 검증 실패', { error: String(err), imp_uid });
    res.status(400).json({ detail: '결제 검증에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
}));

/** 구독 상태 */
paymentRouter.get('/status', authMiddleware, (req: Request, res: Response) => {
  const user = getUserById(req.user!.id);
  if (!user) {
    res.status(401).json({ detail: '사용자를 찾을 수 없습니다' });
    return;
  }

  expireIfNeeded(user);
  const status = user.subscription_status;

  res.json({ status, expires_at: user.subscription_expires_at });
});

/** 구독 취소 */
paymentRouter.post('/cancel', authMiddleware, (req: Request, res: Response) => {
  const user = req.user!;

  expireIfNeeded(user);

  if (user.subscription_status !== 'premium') {
    res.status(400).json({ detail: '활성 프리미엄 구독이 없습니다.' });
    return;
  }

  const db = getDb();
  db.prepare("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?")
    .run(user.id);

  res.json({ ok: true, message: '구독이 만료 후 취소됩니다.' });
});
