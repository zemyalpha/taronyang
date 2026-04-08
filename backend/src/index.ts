/** Express 앱 진입점 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { initDb } from './database';
import { tarotRouter } from './routes/tarot';
import { authRouter } from './routes/auth';
import { readingsRouter } from './routes/readings';
import { paymentRouter } from './routes/payment';
import { adminRouter } from './routes/admin';
import { notifyRouter } from './routes/notify';
import { startDailyScheduler } from './dailyNotify';

// DB 초기화
initDb();

const app = express();

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

// CORS — 프로덕션에서는 프론트엔드 도메인만 허용
const corsOrigins = config.nodeEnv === 'production'
  ? [config.frontendUrl].filter(Boolean)
  : '*';
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// JSON 바디 파서
app.use(express.json({ limit: '1mb' }));

// API 레이트 리미팅 — 일반 API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
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

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
});

// 프로덕션에서 기본 JWT 시크릿 검증
if (config.nodeEnv === 'production' && config.jwtSecret === 'change-me-in-production') {
  console.error('⚠️ 프로덕션 환경에서 기본 JWT 시크릿 사용 중. JWT_SECRET 환경변수를 설정하세요.');
  process.exit(1);
}

// 서버 시작
app.listen(config.port, config.host, () => {
  console.log(`🔮 타로냥 API 서버: http://${config.host}:${config.port} (${config.nodeEnv})`);
  startDailyScheduler();
});

export default app;
