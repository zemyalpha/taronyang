import crypto from 'crypto';
import { getDb } from '../database';
import { callLlm } from '../llm';
import { buildDailyHoroscopePrompt } from '../tarotPrompt';
import { sendEmail } from './email';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export async function generateAndSendDailyHoroscopes(): Promise<number> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  let generated = 0;

  for (const zodiacSign of ZODIAC_SIGNS) {
    const existing = db.prepare(
      'SELECT id FROM daily_horoscopes WHERE date = ? AND zodiac_sign = ?'
    ).get(today, zodiacSign) as { id: string } | undefined;

    if (existing) continue;

    const prompt = buildDailyHoroscopePrompt(zodiacSign);
    const interpretation = await callLlm(prompt);

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO daily_horoscopes (id, date, zodiac_sign, summary, full_reading) VALUES (?, ?, ?, ?, ?)'
    ).run(id, today, zodiacSign, interpretation.slice(0, 100), interpretation);
    generated++;

    const subscribers = db.prepare(
      `SELECT id, email, nickname FROM users
       WHERE zodiac_sign = ? AND email IS NOT NULL AND subscription_status = 'premium'`
    ).all(zodiacSign) as Array<{ id: string; email: string; nickname: string | null }>;

    for (const user of subscribers) {
      try {
        await sendEmail({
          to: user.email,
          subject: `[Taronyang] ${zodiacSign} Daily Horoscope - ${today}`,
          html: buildDailyEmailHtml(zodiacSign, today),
        });
      } catch (err) {
        console.error(`Email send failed (${user.email}):`, err);
      }
    }
  }

  return generated;
}

function buildDailyEmailHtml(sign: string, date: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:'Noto Sans KR',sans-serif;background:#0a0a2e;color:#f8fafc;margin:0;padding:20px}
.container{max-width:480px;margin:0 auto;text-align:center}
h1{font-family:'Noto Serif KR',serif;font-size:24px;color:#a78bfa}
.date{color:#94a3b8;font-size:14px;margin:8px 0 24px}
.btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;padding:12px 32px;border-radius:24px;text-decoration:none;font-weight:700}
.footer{color:#64748b;font-size:12px;margin-top:32px}
</style></head><body><div class="container">
<h1>Taronyang Daily Horoscope</h1>
<p class="date">${date}</p>
<p>${sign} horoscope has arrived!</p>
<p style="margin:24px 0">Click below to see your full reading.</p>
<a href="https://taronyang.com/daily" class="btn">Read Now</a>
<p class="footer">This email was sent by Taronyang.<br>Manage subscriptions: My Page</p>
</div></body></html>`;
}
