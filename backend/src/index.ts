/** Express 앱 진입점 */
import express from 'express';
import cors from 'cors';
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

// SPA 라우팅: 모든 HTML 파일 서빙
const htmlFiles = ['index', 'tarot', 'daily', 'mypage', 'login', 'pricing', 'history'];
for (const name of htmlFiles) {
  app.get(`/${name}`, (_req, res) => {
    res.sendFile(path.join(frontendPath, `${name}.html`));
  });
  app.get(`/${name}.html`, (_req, res) => {
    res.sendFile(path.join(frontendPath, `${name}.html`));
  });
}
app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
});

// 서버 시작
app.listen(config.port, config.host, () => {
  console.log(`🔮 타로냥 API 서버: http://${config.host}:${config.port}`);
  startDailyScheduler();
});

export default app;
