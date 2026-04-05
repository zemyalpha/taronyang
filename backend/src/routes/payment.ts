/** 결제 API 라우터 */
import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getDb, getUserById } from '../database';
import { authMiddleware } from './auth';

export const paymentRouter = Router();

/** 요금 정보 */
paymentRouter.get('/price', (_req: Request, res: Response) => {
  res.json({ premium_price: config.premiumPrice, currency: 'KRW', interval: 'monthly' });
});

/** 결제 검증 + 프리미엄 활성화 */
paymentRouter.post('/verify', authMiddleware, async (req: Request, res: Response) => {
  const { imp_uid } = req.body;
  if (!imp_uid) {
    res.status(400).json({ detail: 'imp_uid가 필요합니다' });
    return;
  }

  // 포트원 API 검증 (실제 구현 시)
  try {
    const db = getDb();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
      .run(expires, (req as any).user.id);

    res.json({ ok: true, message: '프리미엄이 활성화되었습니다! ✨' });
  } catch (err: any) {
    res.status(400).json({ detail: String(err) });
  }
});

/** 구독 상태 */
paymentRouter.get('/status', authMiddleware, (req: Request, res: Response) => {
  const user = getUserById((req as any).user.id);
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
  const db = getDb();
  db.prepare("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?")
    .run((req as any).user.id);

  res.json({ ok: true, message: '구독이 만료 후 취소됩니다.' });
});
