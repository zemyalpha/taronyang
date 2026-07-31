/** 일운 이메일 알림 서비스
 * - LLM으로 12별자리별 일운 생성
 * - Gmail SMTP 이메일 발송
 * - node-cron 매일 7시 실행
 */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { config, getPublicUrl } from './config';
import { getDb } from './database';
import { callLlm } from './llm';
import { getKstDate } from './routes/notify';
import { logger } from './logger';
import { cleanupOldAnalyticsEvents } from './routes/analytics';

function stripChainOfThought(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/<(?:think|reason|thought|analysis|reflection|scratchpad)[\s\S]*?<\/(?:think|reason|thought|analysis|reflection|scratchpad)>/gi, '')
    .replace(/<(?:think|reason|thought|analysis|reflection|scratchpad)[^>]*>[\s\S]*$/gi, '')
    .replace(/^\s*(?:think|reason|thought|analysis|reflection|scratchpad)\s*:\s*[\s\S]*$/gim, '')
    .replace(/^\s*\*\*\s*(?:think|reason|thought|analysis|reflection|scratchpad)\s*\*\*\s*:\s*[\s\S]*$/gim, '')
    .replace(/```(?:think|reason|thought|analysis|reflection|scratchpad)[\s\S]*?```/gi, '')
    .replace(/^#{1,3}\s*(?:think|reason|thought|analysis|reflection|scratchpad)\s*$/gim, '')
    .trim();
}

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

  const FALLBACK_PREFIX = '🐹 오늘';
  const MIN_HOROSCOPE_LENGTH = 300;

  if (cached?.full_reading
    && !cached.full_reading.startsWith(FALLBACK_PREFIX)
    && cached.full_reading.length >= MIN_HOROSCOPE_LENGTH) {
    return cached.full_reading;
  }

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
    const rawHoroscope = await callLlm(messages, 2000, 0.9);
    const horoscope = stripChainOfThought(rawHoroscope);
    // 캐시 저장 (ON CONFLICT: email_sent 플래그 보존)
    db.prepare(
      `INSERT INTO daily_horoscopes (id, zodiac_sign, date, full_reading, summary, scores)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, zodiac_sign) DO UPDATE SET
         full_reading = excluded.full_reading,
         summary = excluded.summary,
         scores = excluded.scores`
    ).run(crypto.randomUUID(), zodiacSign, date, horoscope, horoscope.substring(0, 100), '{}');
    return horoscope;
  } catch (err) {
    logger.error('일운 생성 실패', { zodiac: zodiacSign, error: String(err) });
    const fallback = `🐹 오늘 ${zodiacSign}의 운세를 가져오지 못했어요. 잠시 후 다시 확인해주세요.`;
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
    if (cached && cached.full_reading && cached.full_reading.length >= 300) {
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
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(nickname: string, zodiacSign: string, horoscope: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const safeNickname = escapeHtml(nickname);
  const safeHoroscope = escapeHtml(horoscope).replace(/\n/g, '<br>');
  const safeUrl = escapeHtml(getPublicUrl());
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
      <p style="font-size:18px; margin:0 0 5px;">${safeNickname}님, 안녕하세요! 🐱</p>
      <p style="color:#aaa; font-size:13px; margin:0 0 20px;">${today} · ${zodiacSign}</p>
      <div style="background:#0f3460; border-radius:8px; padding:20px; line-height:1.8; font-size:15px;">
        ${safeHoroscope}
      </div>
      <p style="text-align:center; margin-top:25px;">
        <a href="${safeUrl}" style="background:#e94560; color:#fff; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:14px; display:inline-block;">
          타로 상담 받으러 가기 →
        </a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:15px; text-align:center; color:#666; font-size:11px; border-top:1px solid #333;">
      <p style="margin:0;">타로냥 · 알림 설정 변경: <a href="${safeUrl}/mypage" style="color:#e94560;">마이페이지</a></p>
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
      requireTLS: true,
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

/** 특정 시간대 구독자에게 일운 발송
 *  사용자별 notify_time 설정을 존중하여 해당 시간에만 발송한다.
 *  @param targetTime HH:MM 형식 (기본 07:00)
 *  @returns true if all eligible users in this slot sent successfully */
export async function sendDailyNotifications(targetTime: string = '07:00'): Promise<boolean> {
  const db = getDb();
  const today = getKstDate();

  // 남은 미발송 구독자가 있는지 확인 (서버 재시작 시에도 안전)
  const remaining = db.prepare(
    "SELECT COUNT(*) as cnt FROM users " +
    "WHERE json_extract(settings, '$.daily_email') = 1 " +
    "AND COALESCE(json_extract(settings, '$.last_email_sent_date'), '') != ?"
  ).get(today) as { cnt: number };
  if (remaining.cnt === 0) {
    db.prepare('UPDATE daily_horoscopes SET email_sent = 1 WHERE date = ?').run(today);
    return true;
  }

  // 이 시간대에 해당하며 아직 발송하지 않은 구독자만 조회 (PIPA 준수 — opt-in)
  const enabled = db.prepare(
    "SELECT id, email, nickname, zodiac_sign, settings FROM users " +
    "WHERE zodiac_sign IS NOT NULL AND zodiac_sign != '' AND email IS NOT NULL " +
    "AND json_extract(settings, '$.daily_email') = 1 " +
    "AND COALESCE(json_extract(settings, '$.notify_time'), '07:00') = ? " +
    "AND COALESCE(json_extract(settings, '$.last_email_sent_date'), '') != ?"
  ).all(targetTime, today) as Array<{ id: string; email: string; nickname: string | null; zodiac_sign: string; settings: string }>;

  if (!enabled.length) {
    return true;
  }

  logger.info('일운 이메일 발송 시작', { targetTime, count: enabled.length });

  const horoscopes = await generateAllHoroscopes();
  const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const EMAIL_BATCH_SIZE = 5;
  let sent = 0;
  const results: PromiseSettledResult<boolean>[] = [];

  for (let i = 0; i < enabled.length; i += EMAIL_BATCH_SIZE) {
    const batch = enabled.slice(i, i + EMAIL_BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(async (sub) => {
      const horoscope = horoscopes[sub.zodiac_sign];
      if (!horoscope) return false;

      const nickname = sub.nickname || '회원';
      const html = buildEmailHtml(nickname, sub.zodiac_sign, horoscope);
      const subject = `🔮 ${nickname}님의 ${todayStr} 운세 — ${sub.zodiac_sign}`;

      return sendEmail(sub.email, subject, html);
    }));
    results.push(...batchResults);
  }

  sent = results.filter(r => r.status === 'fulfilled' && r.value).length;

  // 성공한 사용자만 last_email_sent_date 업데이트 (재시도 허용)
  const markSent = db.prepare(
    "UPDATE users SET settings = json_set(COALESCE(settings, '{}'), '$.last_email_sent_date', ?) WHERE id = ?"
  );
  for (let i = 0; i < enabled.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      markSent.run(today, enabled[i].id);
    }
  }

  logger.info('일운 이메일 발송 완료', { targetTime, sent, total: enabled.length });

  // 남은 미발송자가 없으면 email_sent 플래그 설정
  const stillRemaining = db.prepare(
    "SELECT COUNT(*) as cnt FROM users " +
    "WHERE json_extract(settings, '$.daily_email') = 1 " +
    "AND COALESCE(json_extract(settings, '$.last_email_sent_date'), '') != ?"
  ).get(today) as { cnt: number };
  if (stillRemaining.cnt === 0) {
    db.prepare('UPDATE daily_horoscopes SET email_sent = 1 WHERE date = ?').run(today);
  }

  return sent === enabled.length;
}

/** 일운 캐시 사전 생성 (이메일 구독자 유무와 무관하게 매일 12별자리 캐시를 채운다)
 *  콜드 캐시에서 사용자 요청이 LLM을 동기 호출하면 Cloudflare 터널 타임아웃이
 *  발생하므로(콜드 호출 ~20-50s), 사용자 트래픽 전에 미리 생성한다. */
let prewarming = false;
export async function prewarmDailyCache(): Promise<void> {
  if (prewarming) {
    logger.info('일운 캐시 사전 생성 스킵 — 이미 실행 중');
    return;
  }
  prewarming = true;
  try {
    logger.info('일운 캐시 사전 생성 시작');
    await generateAllHoroscopes();
    logger.info('일운 캐시 사전 생성 완료');
  } finally {
    prewarming = false;
  }
}

/** 스케줄러 시작 — interval handle 반환 (graceful shutdown용) */
export function startDailyScheduler(): NodeJS.Timeout {
  // node-cron 대신 setInterval로 간단 구현 (매 분마다 체크)
  const CHECK_INTERVAL = 60_000; // 1분
  let lastPrewarmDate = '';
  let lastCleanupDate = '';

  // 서버 시작 시 오늘 캐시 사전 생성 — 재시작해도 콜드 캐시로 인한 지연이 없음
  prewarmDailyCache().catch((err) =>
    logger.error('시작 시 캐시 사전 생성 오류', { error: String(err) })
  );

  const interval = setInterval(async () => {
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstNow.toISOString().split('T')[0];
    const hour = kstNow.getUTCHours();

    // 매일 06:00(KST) 이후 캐시 사전 생성 — 이메일 구독자 유무와 무관
    if (hour >= 6 && lastPrewarmDate !== today) {
      lastPrewarmDate = today;
      try {
        await prewarmDailyCache();
      } catch (err) {
        logger.error('일운 캐시 사전 생성 오류', { error: String(err) });
      }
    }

    // 사용자별 notify_time에 맞춰 분 단위로 발송
    const currentHHMM = String(hour).padStart(2, '0') + ':' + String(kstNow.getUTCMinutes()).padStart(2, '0');
    try {
      await sendDailyNotifications(currentHHMM);
    } catch (err) {
      logger.error('일운 발송 오류 — 재시도 대기', { error: String(err), date: today, time: currentHHMM });
    }

    // 매일 04:00(KST) 분석 이벤트 정리 (90일 이전 데이터 삭제)
    if (hour >= 4 && lastCleanupDate !== today) {
      lastCleanupDate = today;
      try {
        const deleted = cleanupOldAnalyticsEvents();
        if (deleted > 0) logger.info('분석 이벤트 정리', { deleted });
      } catch (err) {
        logger.error('분석 이벤트 정리 오류', { error: String(err) });
      }
    }
  }, CHECK_INTERVAL);

  logger.info('일운 스케줄러 시작 — 매일 06:00 캐시 생성, 사용자별 notify_time 발송');
  return interval;
}
