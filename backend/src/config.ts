/** 환경 변수 설정 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
dotenv.config();

function safeParseInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  port: safeParseInt(process.env.PORT, 8000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Z.ai LLM API
  zaiApiKey: process.env.ZAI_API_KEY || '',
  zaiApiUrl: process.env.ZAI_API_URL || 'https://api.z.ai/api/coding/paas/v4/chat/completions',
  zaiModel: process.env.ZAI_MODEL || 'glm-5',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpireDays: safeParseInt(process.env.JWT_EXPIRE_DAYS, 7),

  // 관리자 — 실시간 권한 재검증에 사용되므로 모두 소문자로 정규화 (casing-safe includes)
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),

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
  smtpPort: safeParseInt(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',

  // 타로 설정
  freeDailyLimit: safeParseInt(process.env.FREE_DAILY_LIMIT, 1),
  maxDailyChats: safeParseInt(process.env.MAX_DAILY_CHATS, 5),

  // 결제 (포트원)
  portOneImpKey: process.env.PORTONE_IMP_KEY || '',
  portOneImpSecret: process.env.PORTONE_IMP_SECRET || '',

  // 구독
  premiumPrice: safeParseInt(process.env.PREMIUM_PRICE, 9900),

  // DB
  databasePath: process.env.DATABASE_PATH || './taronyang.db',

  // CORS
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:8000').replace(/\/$/, ''),
  extraCorsOrigins: (process.env.EXTRA_CORS_ORIGINS || '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean),
};

/** Cloudflare Quick Tunnel 로그에서 현재 공개 URL을 동적으로 추출.
 *  Quick Tunnel URL은 프로세스 재시작 시마다 변경되므로 정적 .env 대신 런타임에 읽는다.
 *  이메일 링크 등 외부에 노출되는 URL에 사용된다. */
const TUNNEL_LOG_PATHS = ['/tmp/taronyang-tunnel.err', '/tmp/taronyang-tunnel.log'];
let _cachedTunnelUrl = '';
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

function extractTunnelUrl(): string {
  const now = Date.now();
  if (_cachedTunnelUrl && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedTunnelUrl;
  }

  for (const logPath of TUNNEL_LOG_PATHS) {
    try {
      const log = readFileSync(logPath, 'utf-8');
      const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
      if (match && match.length > 0) {
        _cachedTunnelUrl = match[match.length - 1];
        _cacheTimestamp = now;
        return _cachedTunnelUrl;
      }
    } catch { /* file not found or unreadable */ }
  }

  _cacheTimestamp = now;
  return '';
}

/** 이메일 링크 등 외부에 노출되는 공개 URL 반환.
 *  프로덕션에서 FRONTEND_URL이 localhost인 경우 Cloudflare 터널 URL을 동적으로 사용. */
export function getPublicUrl(): string {
  if (config.nodeEnv === 'production' && config.frontendUrl.includes('localhost')) {
    const tunnelUrl = extractTunnelUrl();
    if (tunnelUrl) return tunnelUrl;
  }
  return config.frontendUrl;
}
