/** 결제 API 라우터 */
import { Router, Request, Response } from 'express';
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
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: config.portOneImpKey, imp_secret: config.portOneImpSecret }),
  });
  const data = await res.json() as { code: number; message?: string; response?: { access_token?: string } };
  if (data.code !== 0) throw new Error(`포트원 토큰 발급 실패: ${data.message}`);
  const tokenResponse = data.response;
  if (!tokenResponse?.access_token) {
    throw new Error('포트원 토큰이 응답에 없습니다');
  }
  return tokenResponse.access_token;
}

/** 요금 정보 */
paymentRouter.get('/price', (_req: Request, res: Response) => {
  res.json({ premium_price: config.premiumPrice, currency: 'KRW', interval: 'monthly' });
});

/** 결제 검증 + 프리미엄 활성화 */
paymentRouter.post('/verify', authMiddleware, async (req: Request, res: Response) => {
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
    const payRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payData = await payRes.json() as { code: number; message?: string; response?: { status: string; amount: number } };
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

    // 프리미엄 활성화 + 결제 기록 (트랜잭션)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.transaction(() => {
      db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
        .run(expires, req.user!.id);
      db.prepare('INSERT INTO processed_payments (imp_uid, user_id, amount) VALUES (?, ?, ?)')
        .run(imp_uid, req.user!.id, payment.amount);
    })();

    res.json({ ok: true, message: '프리미엄이 활성화되었습니다! ✨' });
  } catch (err: unknown) {
    logger.error('결제 검증 실패', { error: String(err), imp_uid });
    res.status(400).json({ detail: '결제 검증에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

/** 구독 상태 */
paymentRouter.get('/status', authMiddleware, (req: Request, res: Response) => {
  const user = getUserById(req.user!.id);
  if (!user) {
    res.status(401).json({ detail: '사용자를 찾을 수 없습니다' });
    return;
  }

  let status = user.subscription_status;
  if (status === 'premium' && user.subscription_expires_at) {
    if (new Date(user.subscription_expires_at) < new Date()) {
      const db = getDb();
      db.prepare("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?")
        .run(user.id);
      status = 'free';
    }
  }

  res.json({ status, expires_at: user.subscription_expires_at });
});

/** 구독 취소 */
paymentRouter.post('/cancel', authMiddleware, (req: Request, res: Response) => {
  const user = req.user!;

  if (user.subscription_status === 'premium' && user.subscription_expires_at) {
    if (new Date(user.subscription_expires_at) < new Date()) {
      const db = getDb();
      db.prepare("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?")
        .run(user.id);
      user.subscription_status = 'free';
    }
  }

  if (user.subscription_status !== 'premium') {
    res.status(400).json({ detail: '활성 프리미엄 구독이 없습니다.' });
    return;
  }

  const db = getDb();
  db.prepare("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?")
    .run(user.id);

  res.json({ ok: true, message: '구독이 만료 후 취소됩니다.' });
});
