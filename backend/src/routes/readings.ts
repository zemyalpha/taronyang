/** 상담 기록 저장 서비스 및 라우터 */
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware } from './auth';
import type { TarotCard } from '../tarotData';

type SelectedCard = TarotCard & { is_upright: boolean };

/** 상담 기록 저장 */
export function saveReading(userId: string | null, category: string, question: string, cards: SelectedCard[], interpretation: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, category, question, JSON.stringify(cards), '[]', interpretation);
  return id;
}

export const readingsRouter = Router();

/** 내 상담 기록 목록 */
readingsRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user!.id);

  res.json(rows);
});

/** 상담 기록 상세 */
readingsRouter.get('/:readingId', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE id = ? AND user_id = ?'
  ).get(req.params.readingId, req.user!.id);

  if (!row) {
    res.status(404).json({ detail: '기록을 찾을 수 없습니다' });
    return;
  }
  res.json(row);
});

/** 상담 기록 삭제 */
readingsRouter.delete('/:readingId', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM readings WHERE id = ? AND user_id = ?').run(req.params.readingId, req.user!.id);

  res.json({ ok: true });
});
