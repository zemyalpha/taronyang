/** 헬스체크 라우터 */
import { Router } from 'express';
import os from 'os';
import { config } from '../config';
import { getDb } from '../database';
import { authMiddleware, adminMiddleware } from './auth';

export const healthRouter = Router();

const startTime = new Date();

// 헬스체크 (기본)
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
});

// 헬스체크 (상세 — 관리자 전용, 시스템 정보 노출 방지)
healthRouter.get('/detail', authMiddleware, adminMiddleware, (_req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const db = getDb();
  let dbSize = 0;
  let userCount = 0;
  let readingCount = 0;
  try {
    const stat = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number };
    dbSize = stat.size;
    userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    readingCount = (db.prepare('SELECT COUNT(*) as c FROM readings').get() as { c: number }).c;
  } catch {
    // DB 접근 불가 시 기본값
  }

  res.json({
    status: 'ok',
    service: 'taronyang',
    version: '0.1.0',
    uptime: Math.floor(uptime),
    uptimeHuman: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    startedAt: startTime.toISOString(),
    env: config.nodeEnv,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    },
    system: {
      hostname: os.hostname(),
      loadAvg: os.loadavg().map((l) => l.toFixed(2)),
      freeMem: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      totalMem: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    },
    database: {
      size: `${Math.round(dbSize / 1024)}KB`,
      users: userCount,
      readings: readingCount,
    },
  });
});
