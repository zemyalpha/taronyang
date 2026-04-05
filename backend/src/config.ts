/** 환경 변수 설정 */
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Z.ai LLM API
  zaiApiKey: process.env.ZAI_API_KEY || '',
  zaiApiUrl: process.env.ZAI_API_URL || 'https://api.z.ai/api/coding/paas/v4/chat/completions',
  zaiModel: process.env.ZAI_MODEL || 'glm-5',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpireDays: parseInt(process.env.JWT_EXPIRE_DAYS || '7', 10),

  // 관리자
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean),

  // OAuth - 카카오
  kakaoClientId: process.env.KAKAO_CLIENT_ID || '',
  kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET || '',
  kakaoRedirectUri: process.env.KAKAO_REDIRECT_URI || '',

  // OAuth - 네이버
  naverClientId: process.env.NAVER_CLIENT_ID || '',
  naverClientSecret: process.env.NAVER_CLIENT_SECRET || '',
  naverRedirectUri: process.env.NAVER_REDIRECT_URI || '',

  // OAuth - 구글
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',

  // 이메일 (Gmail SMTP)
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',

  // 타로 설정
  freeDailyLimit: parseInt(process.env.FREE_DAILY_LIMIT || '1', 10),
  maxChatPerReading: parseInt(process.env.MAX_CHAT_PER_READING || '5', 10),

  // 결제 (포트원)
  portOneImpKey: process.env.PORTONE_IMP_KEY || '',
  portOneImpSecret: process.env.PORTONE_IMP_SECRET || '',

  // 구독
  premiumPrice: parseInt(process.env.PREMIUM_PRICE || '9900', 10),

  // DB
  databasePath: process.env.DATABASE_PATH || './taronyang.db',

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8000',
};
