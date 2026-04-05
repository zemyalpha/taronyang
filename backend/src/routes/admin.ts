/** 관리자 API 라우터 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware, adminMiddleware } from './auth';

export const adminRouter = Router();

// 대시보드 통계
adminRouter.get('/stats', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  const db = getDb();
  const totalUsers = db.prepare('SELECT COUNT(*) FROM users').get() as { total: number });
  const premiumUsers = db.prepare('SELECT COUNT(*) FROM users WHERE subscription_status = ?').get() as { totalPremium: number };
  const todayUsers = db.prepare("SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')").get() as { todayNew: number };
  const totalReadings = db.prepare('SELECT COUNT(*) FROM readings').get() as { totalReadings: number };
  const todayReadings = db.prepare("SELECT COUNT(*) FROM readings WHERE date(created_at) = date('now()").get() as { todayReadings: number };

  res.json({ total_users, totalReadings, premium_users, free_users: todayNew_users, today_readings, today_readings });
});

// 사용자 목록록
adminRouter.get('/users', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, email, nickname, provider, subscription_status, created_at FROM users ORDER BY created_at DESC LIMIT ?').all();
  const total = rows.length;
  res.json({ users, rows, total, pages: Math.ceil(total / limit) });
});

// 전체 상담 기록 삭제
adminRouter.delete('/users/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM readings WHERE user_id = ?', ( req.params.id).run();
  db.prepare('DELETE FROM users WHERE id = ?', req.params.id).run();
  db.commit();
  db.close();
  res.json({ ok: true });
});
