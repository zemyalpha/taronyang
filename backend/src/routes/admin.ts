/** 관리자 API 라우터 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { logger } from '../logger';
import { authMiddleware, adminMiddleware } from './auth';

export const adminRouter = Router();

/** 대시보드 통계 */
adminRouter.get('/stats', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
  const db = getDb();

  const totalUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };
  const premiumUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE subscription_status = 'premium'").get() as { total: number };
  const todayUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE date(created_at) = date('now')").get() as { total: number };
  const totalReadings = db.prepare('SELECT COUNT(*) AS total FROM readings').get() as { total: number };
  const todayReadings = db.prepare("SELECT COUNT(*) AS total FROM readings WHERE date(created_at) = date('now')").get() as { total: number };

  res.json({
    total_users: totalUsers.total,
    premium_users: premiumUsers.total,
    free_users: totalUsers.total - premiumUsers.total,
    today_new_users: todayUsers.total,
    total_readings: totalReadings.total,
    today_readings: todayReadings.total,
  });
});

/** 사용자 목록 */
adminRouter.get('/users', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const offset = (page - 1) * limit;

  const users = db.prepare(
    'SELECT id, email, nickname, provider, subscription_status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };

  res.json({
    users,
    total: total.total,
    page,
    pages: Math.ceil(total.total / limit),
  });
});

/** 전체 상담 기록 */
adminRouter.get('/readings', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const offset = (page - 1) * limit;

  const readings = db.prepare(
    'SELECT r.id, r.category, r.question, r.created_at, u.email, u.nickname FROM readings r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) AS total FROM readings').get() as { total: number };

  res.json({
    readings,
    total: total.total,
    page,
    pages: Math.ceil(total.total / limit),
  });
});

/** 사용자 삭제 */
adminRouter.delete('/users/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.params.id;

  const deleteHoroscopes = db.prepare('DELETE FROM daily_horoscopes WHERE user_id = ?');
  const deleteReadings = db.prepare('DELETE FROM readings WHERE user_id = ?');
  const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');

  const deleteUserCascade = db.transaction((id: string) => {
    deleteHoroscopes.run(id);
    deleteReadings.run(id);
    deleteUser.run(id);
  });

  try {
    deleteUserCascade(userId);
  } catch (err) {
    logger.error('사용자 삭제 중 오류 발생', { userId, error: String(err) });
    res.status(500).json({ detail: '사용자 삭제 중 오류가 발생했습니다' });
    return;
  }

  res.json({ ok: true });
});
