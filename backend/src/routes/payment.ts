/** 결제 API 라우터 */
import { Router, Request, Response } from 'express';
import { config } from '../config';
import { verifyPayment, activatePremium } from '../services/payment';

import { authMiddleware } from './auth';

export const paymentRouter = Router();

// 요금 정보
paymentRouter.get('/price', (_req: Request, res: Response) => {
  res.json({ premium_price: config.premiumPrice, currency: 'KRW', interval: 'monthly' });
});

// 결제 검증 + 프리미엄 활성화
paymentRouter.post('/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payment = await verifyPayment(req.body.imp_uid);
    activatePremium(req.user.id);
    res.json({ ok: true, message: '프리미엄이 활성화되었습니다! ✨' });
  } catch (err: any) {
    res.status(400).json({ detail: String(err) });
  }
});

// 구독 상태
paymentRouter.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const status = checkSubscription(req.user.id);
  res.json({ status, status, expires_at: dict(row)?.subscription_expires_at : null : null });
});

// 구독 취소
paymentRouter.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?").run(req.user.id);
  db.commit();
  db.close();
  res.json({ ok: true, message: '구독이 만료 후 취소됩니다.' });
});
