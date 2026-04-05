/** 알림 설정 API 라우터 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware } from './auth';
import { generateDailyHoroscope } from '../dailyNotify';

export const notifyRouter = Router();

interface UserSettings {
  daily_email?: boolean;
  notify_time?: string;
  notify_channel?: string;
}

function getSettings(user: any): UserSettings {
  try { return JSON.parse(user.settings || '{}'); }
  catch { return {}; }
}

/** 알림 설정 조회 */
notifyRouter.get('/settings', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const settings = getSettings(user);
  res.json({
    daily_email: settings.daily_email !== false,
    notify_time: settings.notify_time || '07:00',
    notify_channel: settings.notify_channel || 'email',
    zodiac_sign: user.zodiac_sign || '',
  });
});

/** 알림 설정 변경 (json_set으로 race condition 방지) */
notifyRouter.put('/settings', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const db = getDb();
  const field = req.body.daily_email !== undefined ? '$.daily_email'
    : req.body.notify_time ? '$.notify_time' : '$.notify_channel';
  const value = req.body.daily_email !== undefined ? req.body.daily_email
    : req.body.notify_time ? req.body.notify_time : req.body.notify_channel;
  db.prepare('UPDATE users SET settings = json_set(COALESCE(settings, \'{}\'), ?, ?) WHERE id = ?')
    .run(field, typeof value === 'boolean' ? (value ? 1 : 0) : value, user.id);
  res.json({ ok: true });
});

/** 별자리 변경 */
notifyRouter.put('/zodiac', authMiddleware, (req: Request, res: Response) => {
  const validSigns = [
    '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
    '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
  ];
  const sign = req.body.zodiac_sign;
  if (!sign || !validSigns.includes(sign)) {
    res.status(400).json({ detail: `유효하지 않은 별자리: ${sign}` });
    return;
  }

  const db = getDb();
  db.prepare('UPDATE users SET zodiac_sign = ? WHERE id = ?').run(sign, (req as any).user.id);
  res.json({ ok: true });
});

/** 오늘의 운세 조회 (공개) */
notifyRouter.get('/horoscope/:sign', async (req: Request, res: Response) => {
  const sign = req.params.sign;
  const validSigns = [
    '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
    '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
  ];
  if (!validSigns.includes(sign)) {
    res.status(400).json({ detail: '유효하지 않은 별자리입니다' });
    return;
  }
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const horoscope = await generateDailyHoroscope(sign, today);
    res.json({ zodiac_sign: sign, date: today, horoscope });
  } catch (err: any) {
    res.status(500).json({ detail: '운세 생성에 실패했습니다' });
  }
});
