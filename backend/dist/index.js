"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/** Express 앱 진입점 */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const database_1 = require("./database");
const tarot_1 = require("./routes/tarot");
const auth_1 = require("./routes/auth");
const readings_1 = require("./routes/readings");
const payment_1 = require("./routes/payment");
const admin_1 = require("./routes/admin");
const notify_1 = require("./routes/notify");
const dailyNotify_1 = require("./dailyNotify");
// DB 초기화
(0, database_1.initDb)();
const app = (0, express_1.default)();
// 미들웨어
app.use((0, cors_1.default)({ origin: '*', credentials: true }));
app.use(express_1.default.json());
// API 라우터
app.use('/api/tarot', tarot_1.tarotRouter);
app.use('/api/auth', auth_1.authRouter);
app.use('/api/readings', readings_1.readingsRouter);
app.use('/api/payment', payment_1.paymentRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use('/api/notifications', notify_1.notifyRouter);
// 정적 파일 (프론트엔드)
const frontendPath = path_1.default.join(__dirname, '../../frontend');
app.use('/static', express_1.default.static(frontendPath));
// 루트
app.get('/', (_req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
app.get('/mypage', (_req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'mypage.html'));
});
// 헬스체크
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'taronyang', version: '0.1.0' });
});
// 서버 시작
app.listen(config_1.config.port, config_1.config.host, () => {
    console.log(`🔮 타로냥 API 서버: http://${config_1.config.host}:${config_1.config.port}`);
    (0, dailyNotify_1.startDailyScheduler)();
});
exports.default = app;
