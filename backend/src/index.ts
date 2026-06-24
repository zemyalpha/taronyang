/** Express 앱 진입점 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { analyticsRouter } from './routes/analytics';
import { startDailyScheduler } from './dailyNotify';
import { authMiddleware, adminMiddleware } from './routes/auth';
import { logger } from './logger';

const startTime = new Date();

// DB 초기화
initDb();

const app = express();

// 리버스 프록시 환경에서 클라이언트 IP 및 프로토콜 식별
app.set('trust proxy', 1);

// 보안 헤더 (helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// 프로덕션 환경 HTTPS 강제
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// CORS — 프로덕션에서는 명시적으로 허용된 Origin만 검증 (credentials: true + wildcard 금지)
// Quick Tunnel URL 회전 대응: config.frontendUrl + extraCorsOrigins로 명시적 허용 (ZEMA-2620)
const corsOrigins = config.nodeEnv === 'production'
  ? [config.frontendUrl, ...config.extraCorsOrigins].filter(Boolean)
  : true;

// 동적 Origin 패턴 — GitHub Pages 호스팅 + Cloudflare Quick Tunnel 회전 대응 (ZEMA-2715)
// 이 패턴들은 명시적 allowlist와 별개로 자동 허용되어야 한다 (.env.example 참고)
const corsOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.github\.io$/i, // GitHub Pages (예: https://zemyalpha.github.io)
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i, // Cloudflare Quick Tunnel (회전 대응)
];

// Quick Tunnel URL 회전에도 CORS가 차단되지 않도록 명시적 Origin 검증
function corsOriginCheck(origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) {
  // 개발 모드: 모든 Origin 허용
  if (config.nodeEnv !== 'production') {
    return callback(null, true);
  }
  if (!origin) {
    return callback(null, true); // Same-origin 요청 (Origin 헤더 없음)
  }
  // 명시적으로 허용된 Origin (FRONTEND_URL + EXTRA_CORS_ORIGINS)
  if (Array.isArray(corsOrigins) && corsOrigins.includes(origin)) {
    return callback(null, true);
  }
  // 패턴 기반 동적 허용 — GitHub Pages / Quick Tunnel URL 회전 대응
  if (corsOriginPatterns.some((pattern) => pattern.test(origin))) {
    return callback(null, true);
  }
  return callback(null, false);
}

app.use(cors({
  origin: config.nodeEnv === 'production' ? corsOriginCheck : true,
  credentials: true,
}));

// 요청 로깅 (morgan)
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
  skip: (req) => req.path === '/api/health',
}));

// JSON 바디 파서
app.use(express.json({ limit: '1mb' }));

// API 레이트 리미팅 — 일반 API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/', apiLimiter);

// 인증 API 레이트 리미팅 — 더 엄격
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// API 라우터
app.use('/api/tarot', tarotRouter);
app.use('/api/auth', authRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notifyRouter);
app.use('/api/analytics', analyticsRouter);

// 정적 파일 (프론트엔드)
const frontendPath = path.join(__dirname, '../../frontend');
app.use('/static', express.static(frontendPath));

// PWA 자산 — Service Worker, Web App Manifest, 아이콘
// SW는 항상 최신 버전을 제공하기 위해 no-cache
app.get('/sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.join(frontendPath, 'sw.js'));
});
app.get('/manifest.json', (_req, res) => {
  res.set('Content-Type', 'application/manifest+json; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(frontendPath, 'manifest.json'));
});
// 아이콘 — 장기 캐싱 (immutable)
app.use('/icons', express.static(path.join(frontendPath, 'icons'), {
  maxAge: '1y',
  immutable: true,
}));

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

// 헬스체크 (상세 — 관리자 전용, 시스템 정보 노출 방지)
app.get('/api/health/detail', authMiddleware, adminMiddleware, (_req, res) => {
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
  logger.error('처리되지 않은 에러', { message: err.message, stack: err.stack });
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다.',
    ...(config.nodeEnv !== 'production' && { detail: err.message }),
  });
});

// 프로덕션에서 기본 JWT 시크릿 검증
if (config.nodeEnv === 'production' && config.jwtSecret === 'change-me-in-production') {
  logger.error('프로덕션 환경에서 기본 JWT 시크릿 사용 중. JWT_SECRET 환경변수를 설정하세요.');
  process.exit(1);
}

// 서버 시작
app.listen(config.port, config.host, () => {
  logger.info('타로냥 API 서버 시작', { host: config.host, port: config.port, env: config.nodeEnv });
  startDailyScheduler();
});

export default app;
