/** Express 앱 진입점 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import os from 'os';
import { config } from './config';
import { initDb, getDb } from './database';
import { tarotRouter } from './routes/tarot';
import { authRouter } from './routes/auth';
import { readingsRouter } from './routes/readings';
import { paymentRouter } from './routes/payment';
import { adminRouter } from './routes/admin';
import { notifyRouter } from './routes/notify';
import { startDailyScheduler } from './dailyNotify';

const startTime = new Date();

// DB 초기화
initDb();

const app = express();

// 요청 로깅 (morgan)
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
  skip: (req) => req.path === '/api/health',
}));

// 미들웨어
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// API 라우터
app.use('/api/tarot', tarotRouter);
app.use('/api/auth', authRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notifyRouter);

// 정적 파일 (프론트엔드)
const frontendPath = path.join(__dirname, '../../frontend');
app.use('/static', express.static(frontendPath));

const htmlPages = [
  { route: '/', file: 'index.html' },
  { route: '/tarot', file: 'tarot.html' },
  { route: '/daily', file: 'daily.html' },
  { route: '/history', file: 'history.html' },
  { route: '/mypage', file: 'mypage.html' },
  { route: '/login', file: 'login.html' },
  { route: '/pricing', file: 'pricing.html' },
  { route: '/admin', file: 'admin/index.html' },
];

htmlPages.forEach(({ route, file }) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(frontendPath, file));
  });
});

// 헬스체크 (기본)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
});

// 헬스체크 (상세 — 업타임 모니터링용)
app.get('/api/health/detail', (_req, res) => {
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

// 전역 에러 핸들러
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`❌ 처리되지 않은 에러: ${err.message}`, err.stack);
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다.',
    ...(config.nodeEnv !== 'production' && { detail: err.message }),
  });
});

// 서버 시작
app.listen(config.port, config.host, () => {
  console.log(`🔮 타로냥 API 서버: http://${config.host}:${config.port} (${config.nodeEnv})`);
  startDailyScheduler();
});

export default app;
