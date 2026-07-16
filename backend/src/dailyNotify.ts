/** 일운 이메일 알림 서비스
 * - LLM으로 12별자리별 일운 생성
 * - Gmail SMTP 이메일 발송
 * - node-cron 매일 7시 실행
 */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { config } from './config';
import { getDb } from './database';
import { callLlm } from './llm';
import { getKstDate } from './routes/notify';
import { toKstDate, getKstDateStringKo } from './datetime';
import { logger } from './logger';

const ZODIAC_SIGNS = [
  '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
  '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
];

/** 일운 생성 (LLM) */
export async function generateDailyHoroscope(zodiacSign: string, date: string): Promise<string> {
  const db = getDb();

  // 캐시 확인
  const cached = db.prepare(
    'SELECT full_reading FROM daily_horoscopes WHERE zodiac_sign = ? AND date = ?'
  ).get(zodiacSign, date) as { full_reading?: string } | undefined;

  if (cached?.full_reading) return cached.full_reading;

  const prompt = `오늘의 운세를 작성해주세요.

별자리: ${zodiacSign}
날짜: ${date}

다음 항목을 포함해주세요:
1. 종합 운세 (2~3문장)
2. ⭐ 운세 지수 (1~5점): 사랑, 재물, 건강, 행운
3. 💡 오늘의 조언 (1문장)
4. 🎨 Lucky 컬러 & 아이템

따뜻하고 친근한 톤으로, 너무 막연하지 않게 작성해주세요.
마크다운 형식으로 작성해주세요.`;

  const messages = [
    { role: 'system' as const, content: '너는 타로냥, 친근한 AI 타로 점성술사야. 한국어로 따뜻하게 운세를 알려줘.' },
    { role: 'user' as const, content: prompt },
  ];

  try {
    const horoscope = await callLlm(messages, 800, 0.9);
    // 캐시 저장
    db.prepare(
      'INSERT OR IGNORE INTO daily_horoscopes (id, zodiac_sign, date, full_reading, summary, scores) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), zodiacSign, date, horoscope, horoscope.substring(0, 100), '{}');
    return horoscope;
  } catch (err) {
    logger.error('일운 생성 실패', { zodiac: zodiacSign, error: String(err) });
    const fallback = `🐹 오늘 ${zodiacSign}의 운세를 가져오지 못했어요. 잠시 후 다시 확인해주세요.`;
    try {
      db.prepare(
        'INSERT OR IGNORE INTO daily_horoscopes (id, zodiac_sign, date, full_reading, summary, scores) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), zodiacSign, date, fallback, fallback.substring(0, 100), '{}');
    } catch (dbErr) {
      logger.error('일운 실패 캐시 저장 실패', { error: String(dbErr) });
    }
    return fallback;
  }
}

/** 12별자리 전체 일운 생성 (순차 처리로 API 레이트 리미트 방지) */
export async function generateAllHoroscopes(): Promise<Record<string, string>> {
  const today = getKstDate();
  const db = getDb();
  const stmt = db.prepare(
    'SELECT full_reading FROM daily_horoscopes WHERE zodiac_sign = ? AND date = ?'
  );
  const entries: [string, string][] = [];
  let needsDelay = false;
  for (const sign of ZODIAC_SIGNS) {
    const cached = stmt.get(sign, today) as { full_reading?: string } | undefined;

    let horoscope: string;
    if (cached && cached.full_reading) {
      horoscope = cached.full_reading;
    } else {
      if (needsDelay) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      horoscope = await generateDailyHoroscope(sign, today);
      needsDelay = true;
    }
    entries.push([sign, horoscope]);
  }
  return Object.fromEntries(entries);
}

/** 이메일 HTML 템플릿 */
function buildEmailHtml(nickname: string, zodiacSign: string, horoscope: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const horoscopeHtml = horoscope.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#1a1a2e; font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#16213e; border-radius:12px; overflow:hidden;">
  <tr>
    <td style="background:linear-gradient(135deg,#0f3460,#533483); padding:30px; text-align:center;">
      <h1 style="color:#e94560; margin:0; font-size:28px;">🔮 타로냥</h1>
      <p style="color:#eee; margin:8px 0 0; font-size:14px;">오늘의 운세</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px; color:#eee;">
      <p style="font-size:18px; margin:0 0 5px;">${nickname}님, 안녕하세요! 🐱</p>
      <p style="color:#aaa; font-size:13px; margin:0 0 20px;">${today} · ${zodiacSign}</p>
      <div style="background:#0f3460; border-radius:8px; padding:20px; line-height:1.8; font-size:15px;">
        ${horoscopeHtml}
      </div>
      <p style="text-align:center; margin-top:25px;">
        <a href="${config.frontendUrl}" style="background:#e94560; color:#fff; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:14px; display:inline-block;">
          타로 상담 받으러 가기 →
        </a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:15px; text-align:center; color:#666; font-size:11px; border-top:1px solid #333;">
      <p style="margin:0;">타로냥 · 알림 설정 변경: <a href="${config.frontendUrl}/mypage" style="color:#e94560;">마이페이지</a></p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** SMTP transporter 재사용 (싱글톤) */
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: false,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    });
  }
  return _transporter;
}

/** SMTP 전송 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.smtpUser || !config.smtpPassword) {
    logger.warn('SMTP 설정 없음 — 이메일 발송 건너뜀');
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: `"타로냥" <${config.smtpUser}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    logger.error('이메일 발송 실패', { to, error: String(err) });
    return false;
  }
}

/** 구독자 전체에게 일운 발송 */
export async function sendDailyNotifications(): Promise<void> {
  logger.info('일운 이메일 발송 시작');

  const db = getDb();

  // DB에서 발송 완료 여부 확인 (서버 재시작 시에도 안전)
  const today = getKstDate();
  const alreadySent = db.prepare(
    'SELECT COUNT(*) as cnt FROM daily_horoscopes WHERE date = ? AND email_sent = 1'
  ).get(today) as { cnt: number };
  if (alreadySent.cnt >= ZODIAC_SIGNS.length) {
    logger.info('오늘 이미 발송 완료 — 건너뜀', { date: today });
    return;
  }

  // DB에서 알림 수신 동의한 사용자만 직접 조회
  const enabled = db.prepare(
    "SELECT id, email, nickname, zodiac_sign, settings FROM users " +
    "WHERE zodiac_sign IS NOT NULL AND zodiac_sign != '' AND email IS NOT NULL " +
    "AND (json_extract(settings, '$.daily_email') IS NULL OR json_extract(settings, '$.daily_email') != 0)"
  ).all() as Array<{ id: string; email: string; nickname: string | null; zodiac_sign: string; settings: string }>;

  if (!enabled.length) {
    logger.info('구독자 없음 — 발송 건너뜀');
    return;
  }

  const horoscopes = await generateAllHoroscopes();
  const todayStr = getKstDateStringKo();
  let sent = 0;

  const results = await Promise.allSettled(enabled.map(async (sub) => {
    const horoscope = horoscopes[sub.zodiac_sign];
    if (!horoscope) return;

    const nickname = sub.nickname || '회원';
    const html = buildEmailHtml(nickname, sub.zodiac_sign, horoscope);
    const subject = `🔮 ${nickname}님의 ${todayStr} 운세 — ${sub.zodiac_sign}`;

    return sendEmail(sub.email, subject, html);
  }));

  sent = results.filter(r => r.status === 'fulfilled' && r.value).length;

  logger.info('일운 이메일 발송 완료', { sent, total: enabled.length });

  // 발송 완료 기록
  db.prepare('UPDATE daily_horoscopes SET email_sent = 1 WHERE date = ?').run(today);
}

/** 스케줄러 시작 */
export function startDailyScheduler(): void {
  // node-cron 대신 setInterval로 간단 구현 (매 분마다 체크, 07:00에 실행)
  const CHECK_INTERVAL = 60_000; // 1분
  let lastSentDate = '';

  setInterval(async () => {
    const kstNow = toKstDate();
    const today = kstNow.toISOString().slice(0, 10);
    const hour = kstNow.getUTCHours();

    if (hour >= 7 && lastSentDate !== today) {
      lastSentDate = today;
      try {
        await sendDailyNotifications();
      } catch (err) {
        logger.error('일운 발송 오류', { error: String(err) });
      }
    }
  }, CHECK_INTERVAL);

  logger.info('일운 스케줄러 시작 — 매일 07:00 발송');
}
