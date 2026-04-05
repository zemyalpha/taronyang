"""
일운 이메일 알림 서비스
- LLM으로 별자리별 일운 생성
- Gmail SMTP로 이메일 발송
- APScheduler 매일 7시 실행
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, date

import config
from database import fetch_all, fetch_one, execute
from services.llm import call_llm

logger = logging.getLogger(__name__)

ZODIAC_SIGNS = [
    "양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리",
    "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리",
]


async def generate_daily_horoscope(zodiac_sign: str, target_date: str) -> str:
    """LLM으로 일운 생성"""
    # 캐시 확인
    cached = await fetch_one(
        "SELECT horoscope FROM daily_horoscopes WHERE zodiac_sign=? AND date=?",
        (zodiac_sign, target_date),
    )
    if cached:
        return cached["horoscope"]

    prompt = f"""오늘의 운세를 작성해주세요.

별자리: {zodiac_sign}
날짜: {target_date}

다음 항목을 포함해주세요:
1. 종합 운세 (2~3문장)
2. ⭐ 운세 지수 (1~5점): 사랑, 재물, 건강, 행운
3. 💡 오늘의 조언 (1문장)
4. 🎨 Lucky 컬러 & 아이템

따뜻하고 친근한 톤으로, 너무 막연하지 않게 작성해주세요.
마크다운 형식으로 작성해주세요."""

    messages = [
        {"role": "system", "content": "너는 타로냥, 친근한 AI 타로 점성술사야. 한국어로 따뜻하게 운세를 알려줘."},
        {"role": "user", "content": prompt},
    ]

    try:
        horoscope = await call_llm(messages, max_tokens=800, temperature=0.9)

        # 캐시 저장
        await execute(
            "INSERT OR IGNORE INTO daily_horoscopes (zodiac_sign, date, horoscope) VALUES (?, ?, ?)",
            (zodiac_sign, target_date, horoscope),
        )
        return horoscope
    except Exception as e:
        logger.error("일운 생성 실패 (%s): %s", zodiac_sign, e)
        return f"🐹 오늘 {zodiac_sign}의 운세를 가져오지 못했어요. 잠시 후 다시 확인해주세요."


async def generate_all_horoscopes() -> dict[str, str]:
    """12별자리 전체 일운 생성"""
    today = date.today().isoformat()
    results = {}
    for sign in ZODIAC_SIGNS:
        results[sign] = await generate_daily_horoscope(sign, today)
        await asyncio.sleep(0.5)  # Rate limit
    return results


def build_email_html(nickname: str, zodiac_sign: str, horoscope: str) -> str:
    """이메일 HTML 템플릿"""
    today = date.today().strftime("%Y년 %m월 %d일")
    return f"""<!DOCTYPE html>
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
      <p style="font-size:18px; margin:0 0 5px;">{nickname}님, 안녕하세요! 🐱</p>
      <p style="color:#aaa; font-size:13px; margin:0 0 20px;">{today} · {zodiac_sign}</p>
      <div style="background:#0f3460; border-radius:8px; padding:20px; line-height:1.8; font-size:15px;">
        {horoscope.replace(chr(10), '<br>')}
      </div>
      <p style="text-align:center; margin-top:25px;">
        <a href="{config.FRONTEND_URL}" style="background:#e94560; color:#fff; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:14px; display:inline-block;">
          타로 상담 받으러 가기 →
        </a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:15px; text-align:center; color:#666; font-size:11px; border-top:1px solid #333;">
      <p style="margin:0;">타로냥 · 알림 설정 변경: <a href="{config.FRONTEND_URL}/mypage" style="color:#e94560;">마이페이지</a></p>
    </td>
  </tr>
</table>
</body>
</html>"""


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Gmail SMTP로 이메일 발송"""
    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        logger.warning("SMTP 설정 없음 — 이메일 발송 건너뜀")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"타로냥 <{config.SMTP_USER}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # SMTP는 동기이므로 스레드에서 실행
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp, msg)
        return True
    except Exception as e:
        logger.error("이메일 발송 실패 (%s): %s", to, e)
        return False


def _send_smtp(msg):
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
        server.starttls()
        server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)


async def send_daily_notifications():
    """구독자 전체에게 일운 이메일 발송"""
    logger.info("📧 일운 이메일 발송 시작")

    # 알림 수신 동의한 사용자 조회
    subscribers = await fetch_all("""
        SELECT u.id, u.email, u.nickname, u.zodiac_sign,
               dn.notify_time, dn.channel
        FROM daily_notifications dn
        JOIN users u ON u.id = dn.user_id
        WHERE dn.enabled = 1
    """)

    if not subscribers:
        logger.info("구독자 없음 — 발송 건너뜀")
        return

    # 일운 미리 생성 (별자리별 1회씩만)
    horoscopes = await generate_all_horoscopes()
    today = date.today().isoformat()
    today_fmt = date.today().strftime("%m월 %d일")

    sent = 0
    for sub in subscribers:
        zodiac = sub["zodiac_sign"]
        if not zodiac:
            continue

        horoscope = horoscopes.get(zodiac, "")
        if not horoscope:
            continue

        nickname = sub["nickname"] or "회원"
        html = build_email_html(nickname, zodiac, horoscope)
        subject = f"🔮 {nickname}님의 {today_fmt} 운세 — {zodiac}"

        if sub["channel"] == "email":
            ok = await send_email(sub["email"], subject, html)
            if ok:
                sent += 1
                await execute(
                    "UPDATE daily_notifications SET last_sent_at=? WHERE user_id=?",
                    (datetime.now().isoformat(), sub["id"]),
                )

    logger.info("📧 일운 이메일 발송 완료: %d/%d", sent, len(subscribers))


def setup_scheduler(app):
    """APScheduler 설정 — FastAPI lifespan에서 호출"""
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        send_daily_notifications,
        "cron",
        hour=7,
        minute=0,
        id="daily_horoscope_email",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("⏰ APScheduler 시작 — 매일 07:00 일운 발송")

    # FastAPI 종료 시 스케줄러도 종료
    @app.on_event("shutdown")
    async def shutdown_scheduler():
        scheduler.shutdown()
        logger.info("⏰ APScheduler 종료")
