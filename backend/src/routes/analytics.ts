/** Analytics — 사용자 행동 이벤트 수집 및 요약 (ZEMA-2638) */
import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { logger } from '../logger';
import { authMiddleware, adminMiddleware } from './auth';
import { analyticsBatchSchema } from '../validation';

export const analyticsRouter = Router();

interface AnalyticsEvent {
  name: string;
  props?: Record<string, unknown>;
  path?: string;
  referrer?: string;
  session_id?: string;
  ts?: string;
}

/**
 * POST /api/analytics/event
 * Batch-accept analytics events from the frontend.
 * No auth required (anonymous events). Rate-limited at the app level.
 */
analyticsRouter.post('/event', (req: Request, res: Response) => {
  const parsed = analyticsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'events array required' });
  }

  const batch = parsed.data.events.slice(0, 20);
  const db = getDb();
  const ip = (String(req.headers['x-forwarded-for'] ?? '') || req.socket.remoteAddress || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';

  const insert = db.prepare(`
    INSERT INTO analytics_events (id, name, props, path, referrer, session_id, ip, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = db.transaction((rows: AnalyticsEvent[]) => {
    for (const ev of rows) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const propsJson = (() => {
        try { return JSON.stringify(ev.props || {}); } catch { return '{}'; }
      })();
      insert.run(
        id,
        String(ev.name || 'unknown').slice(0, 100),
        propsJson,
        String(ev.path || '').slice(0, 500),
        String(ev.referrer || '').slice(0, 500),
        String(ev.session_id || '').slice(0, 100),
        ip.slice(0, 45),
        ua.slice(0, 500),
      );
    }
  });

  try {
    insertMany(batch);
  } catch (err) {
    logger.error('Analytics event insert failed', { error: String(err) });
    return res.status(500).json({ error: 'Failed to store events' });
  }

  logger.debug('Analytics events stored', { count: batch.length });
  return res.status(201).json({ stored: batch.length });
});

/**
 * GET /api/analytics/summary
 * Admin-only summary of collected events.
 */
analyticsRouter.get('/summary', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const days = Math.min(parseInt(String(req.query.days)) || 7, 90);

  try {
    const topEvents = db.prepare(`
      SELECT name, COUNT(*) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', ?)
      GROUP BY name
      ORDER BY count DESC
      LIMIT 20
    `).all(`-${days} days`) as { name: string; count: number }[];

    const dailyTrend = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(`-${days} days`) as { date: string; count: number }[];

    const uniqueSessions = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', ?)
    `).get(`-${days} days`) as { count: number };

    const pageViews = db.prepare(`
      SELECT path, COUNT(*) as count
      FROM analytics_events
      WHERE name = 'page_view' AND created_at >= datetime('now', ?)
      GROUP BY path
      ORDER BY count DESC
      LIMIT 15
    `).all(`-${days} days`) as { path: string; count: number }[];

    return res.json({
      days,
      totalEvents: dailyTrend.reduce((sum, d) => sum + d.count, 0),
      uniqueSessions: uniqueSessions.count,
      topEvents,
      dailyTrend,
      pageViews,
    });
  } catch (err) {
    logger.error('Analytics summary failed', { error: String(err) });
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
});
