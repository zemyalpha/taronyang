/** Express 앱 진입점 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { initDb } from './database';
import { tarotRouter } from './routes/tarot';
import { authRouter } from './routes/auth';
import { readingsRouter } from './routes/readings';
import { paymentRouter } from './routes/payment';
import { adminRouter } from './routes/admin';
import { notifyRouter } from './routes/notify';
import { analyticsRouter, cleanupOldAnalyticsEvents } from './routes/analytics';
import { healthRouter } from './routes/health';
import { startDailyScheduler } from './dailyNotify';
import { closeDb } from './database';
import { logger } from './logger';

// DB 초기화
initDb();
// 오래된 분석 이벤트 정리 (시작 시 1회)
try {
  cleanupOldAnalyticsEvents();
} catch (e) {
  logger.warn('Analytics cleanup failed on startup', { error: String(e) });
}

const app = express();

// 리버스 프록시 환경에서 클라이언트 IP 및 프로토콜 식별
app.set('trust proxy', 1);

// 보안 헤더 (helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// 프로덕션 환경 HTTPS 강제 (host 헤더 검증으로 오픈 리다이렉트 방지)
if (config.nodeEnv === 'production') {
  const allowedHosts = [
    ...(config.frontendUrl ? [(() => { try { return new URL(config.frontendUrl).host; } catch { return ''; } })()] : []),
    ...config.extraCorsOrigins.map(o => { try { return new URL(o).host; } catch { return ''; } }).filter(Boolean),
  ].filter(Boolean);
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      const host = req.hostname;
      if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
        return res.status(403).json({ error: 'Host not allowed' });
      }
      return res.redirect(301, `https://${host}${req.url}`);
    }
    next();
  });
}

// CORS — 프로덕션에서는 명시적으로 허용된 Origin만 검증 (credentials: true + wildcard 금지)
// Quick Tunnel URL 회전 대응: config.frontendUrl + extraCorsOrigins로 명시적 허용 (ZEMA-2620)
const corsOrigins = config.nodeEnv === 'production'
  ? [config.frontendUrl, ...config.extraCorsOrigins].filter(Boolean)
  : true;

// 명시적 Origin 검증 — credentials: true이므로 와일드카드 패턴(*.github.io 등) 금지 (ZEMA-2715)
// 허용할 Origin은 FRONTEND_URL 또는 EXTRA_CORS_ORIGINS 환경변수에 명시적으로 등록
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

// 쿠키 파서 (HttpOnly JWT 인증용)
app.use(cookieParser());

// API 레이트 리미팅 — 일반 API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' || req.path === '/api/health/detail',
  message: { detail: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/', apiLimiter);

// 인증 API 레이트 리미팅 — 더 엄격
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// 결제 검증 레이트 리미팅 — PortOne 외부 API 호출 방어
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: '결제 검증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/payment/verify', paymentLimiter);

// 타로 API 레이트 리미팅 — LLM 비용 방어 (read/chat만)
const tarotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: '타로 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/tarot/read', tarotLimiter);
app.use('/api/tarot/chat', tarotLimiter);

// 운세 API 레이트 리미팅 — LLM 비용 방어 (cold cache 시 LLM 호출 유발)
const horoscopeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: '운세 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/notifications/horoscope', horoscopeLimiter);

// 분석 엔드포인트 전용 레이트 리미팅 (무기한 DB 증식 방지)
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// API 라우터
app.use('/api/tarot', tarotRouter);
app.use('/api/auth', authRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notifyRouter);
app.use('/api/analytics', analyticsLimiter);
app.use('/api/analytics', analyticsRouter);

// 정적 파일 (프론트엔드 자산만 — js/css/icons 하위 디렉토리만 노출)
const frontendPath = path.join(__dirname, '../../frontend');
app.use('/static/js', express.static(path.join(frontendPath, 'js')));
app.use('/static/css', express.static(path.join(frontendPath, 'css')));
app.use('/static/icons', express.static(path.join(frontendPath, 'icons'), {
  maxAge: '1y',
  immutable: true,
}));

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

// SEO 파일 — sitemap.xml, robots.txt, rss.xml
app.get('/sitemap.xml', (_req, res) => {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(frontendPath, 'sitemap.xml'));
});
app.get('/robots.txt', (_req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(frontendPath, 'robots.txt'));
});
app.get('/rss.xml', (_req, res) => {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.sendFile(path.join(frontendPath, 'rss.xml'));
});
// 아이콘 — 장기 캐싱 (immutable)
app.use('/icons', express.static(path.join(frontendPath, 'icons'), {
  maxAge: '1y',
  immutable: true,
}));

// 블로그 정적 페이지 (SEO 콘텐츠 + 일일 운세 메타데이터)
app.use('/blog', express.static(path.join(frontendPath, 'blog'), {
  extensions: ['html'],
  maxAge: '1h',
}));

// 타로카드 의미 페이지 (78장 메이저+마이너 아르카나)
app.use('/cards', express.static(path.join(frontendPath, 'cards'), {
  extensions: ['html'],
  maxAge: '1h',
}));

const htmlPages = [
  { route: '/', file: 'index.html' },
  { route: '/tarot', file: 'tarot.html' },
  { route: '/daily', file: 'daily.html' },
  { route: '/history', file: 'history.html' },
  { route: '/mypage', file: 'mypage.html' },
  { route: '/login', file: 'login.html' },
  { route: '/pricing', file: 'pricing.html' },
  { route: '/faq', file: 'faq.html' },
  { route: '/admin', file: 'admin/index.html' },
];

htmlPages.forEach(({ route, file }) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(frontendPath, file));
  });
});

// 헬스체크
app.use('/api/health', healthRouter);

// 전역 에러 핸들러
app.use((err: Error & { status?: number; statusCode?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: '잘못된 JSON 형식입니다.' });
    return;
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error('처리되지 않은 에러', { message: err.message, stack: err.stack });
  }
  res.status(status).json({
    error: status >= 500 ? '서버 내부 오류가 발생했습니다.' : err.message,
    ...(config.nodeEnv !== 'production' && status >= 500 && { detail: err.message }),
  });
});

// 프로덕션에서 기본 JWT 시크릿 검증
if (config.nodeEnv === 'production' && config.jwtSecret === 'change-me-in-production') {
  logger.error('프로덕션 환경에서 기본 JWT 시크릿 사용 중. JWT_SECRET 환경변수를 설정하세요.');
  process.exit(1);
}

// 서버 시작
let schedulerHandle: NodeJS.Timeout | undefined;
const server = app.listen(config.port, config.host, () => {
  logger.info('타로냥 API 서버 시작', { host: config.host, port: config.port, env: config.nodeEnv });
  schedulerHandle = startDailyScheduler();
});

server.timeout = 30000;
server.headersTimeout = 35000;
server.requestTimeout = 40000;
server.keepAliveTimeout = 5000;

// Graceful shutdown — SIGTERM/SIGINT 수신 시 안전하게 종료
let shuttingDown = false;

function gracefulShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Graceful shutdown 시작', { signal });

  if (schedulerHandle) {
    clearInterval(schedulerHandle);
  }

  server.close((err) => {
    if (err) {
      logger.error('서버 종료 중 오류', { error: String(err) });
    }
    try {
      closeDb();
    } catch (dbErr) {
      logger.error('DB 종료 중 오류', { error: String(dbErr) });
    }
    logger.info('Graceful shutdown 완료');
    process.exit(err ? 1 : 0);
  });

  // 10초 내에 종료되지 않으면 강제 종료
  setTimeout(() => {
    logger.error('Graceful shutdown 타임아웃 — 강제 종료');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
