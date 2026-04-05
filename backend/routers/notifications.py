"""
알림 설정 API 라우터
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from database import fetch_one, fetch_all, execute
import jwt
import config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_user_id(authorization: str = Header(None)) -> int:
    """JWT에서 user_id 추출"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        return int(payload["user_id"])
    except Exception:
        raise HTTPException(401, "유효하지 않은 토큰입니다")


class NotificationSettings(BaseModel):
    enabled: bool = True
    notify_time: str = "07:00"
    channel: str = "email"


class ZodiacUpdate(BaseModel):
    zodiac_sign: str


@router.get("/settings")
async def get_notification_settings(authorization: Optional[str] = Header(None)):
    """알림 설정 조회"""
    user_id = get_user_id(authorization)
    row = await fetch_one(
        "SELECT * FROM daily_notifications WHERE user_id=?", (user_id,)
    )
    if not row:
        return {"enabled": True, "notify_time": "07:00", "channel": "email", "zodiac_sign": ""}
    return row


@router.put("/settings")
async def update_notification_settings(
    settings: NotificationSettings,
    authorization: Optional[str] = Header(None),
):
    """알림 설정 변경"""
    user_id = get_user_id(authorization)
    existing = await fetch_one(
        "SELECT id FROM daily_notifications WHERE user_id=?", (user_id,)
    )
    if existing:
        await execute(
            "UPDATE daily_notifications SET enabled=?, notify_time=?, channel=? WHERE user_id=?",
            (int(settings.enabled), settings.notify_time, settings.channel, user_id),
        )
    else:
        await execute(
            "INSERT INTO daily_notifications (user_id, enabled, notify_time, channel) VALUES (?, ?, ?, ?)",
            (user_id, int(settings.enabled), settings.notify_time, settings.channel),
        )
    return {"ok": True}


@router.put("/zodiac")
async def update_zodiac(
    data: ZodiacUpdate,
    authorization: Optional[str] = Header(None),
):
    """별자리 변경"""
    user_id = get_user_id(authorization)
    valid_signs = [
        "양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리",
        "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리",
    ]
    if data.zodiac_sign not in valid_signs:
        raise HTTPException(400, f"유효하지 않은 별자리입니다: {data.zodiac_sign}")
    await execute(
        "UPDATE users SET zodiac_sign=? WHERE id=?", (data.zodiac_sign, user_id)
    )
    return {"ok": True}


@router.get("/horoscope/{zodiac_sign}")
async def get_today_horoscope(zodiac_sign: str):
    """오늘의 운세 조회 (공개)"""
    from services.daily_notify import generate_daily_horoscope
    from datetime import date

    today = date.today().isoformat()
    horoscope = await generate_daily_horoscope(zodiac_sign, today)
    return {"zodiac_sign": zodiac_sign, "date": today, "horoscope": horoscope}
