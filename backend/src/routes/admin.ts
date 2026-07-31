/** 관리자 API 라우터 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware, adminMiddleware } from './auth';
import { logger } from '../logger';

export const adminRouter = Router();

/** 대시보드 통계 */
adminRouter.get('/stats', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
  const db = getDb();

  const totalUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };
  const premiumUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE subscription_status = 'premium'").get() as { total: number };
  const todayUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE date(created_at) = date('now', '+9 hours')").get() as { total: number };
  const totalReadings = db.prepare('SELECT COUNT(*) AS total FROM readings').get() as { total: number };
  const todayReadings = db.prepare("SELECT COUNT(*) AS total FROM readings WHERE date(created_at) = date('now', '+9 hours')").get() as { total: number };

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
  const limit = Math.min(parseInt(String(req.query.limit), 10) || 20, 100);
  const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
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
  const limit = Math.min(parseInt(String(req.query.limit), 10) || 20, 100);
  const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
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

  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: '자기 자신을 삭제할 수 없습니다.' });
    return;
  }

  const target = db.prepare('SELECT email, is_admin FROM users WHERE id = ?').get(req.params.id) as { email: string | null; is_admin: number } | undefined;
  if (!target) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  if (target.is_admin) {
    res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
    return;
  }

  const deleteMany = db.transaction(() => {
    db.prepare('DELETE FROM processed_payments WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM daily_horoscopes WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM readings WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  });
  deleteMany();

  logger.info('admin user delete', {
    actor: req.user!.id,
    actor_email: req.user!.email,
    target_id: req.params.id,
    target_email: target.email ?? 'unknown',
  });

  res.json({ ok: true });
});
