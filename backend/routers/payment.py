"""
결제 & 구독 API (포트원 연동)
"""
import logging
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from database import fetch_one, fetch_all, execute
import config
from routers.auth import make_token
import jwt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payment", tags=["payment"])


def get_user_id(authorization: str = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        return int(payload["user_id"])
    except Exception:
        raise HTTPException(401, "유효하지 않은 토큰")


class VerifyRequest(BaseModel):
    imp_uid: str


@router.post("/verify")
async def verify_payment(req: VerifyRequest, authorization: str = Header(None)):
    """포트원 결제 검증"""
    user_id = get_user_id(authorization)

    if not config.PORTONE_IMP_KEY or not config.PORTONE_IMP_SECRET:
        raise HTTPException(500, "결제 설정이 완료되지 않았습니다")

    # 포트원 토큰 발급
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://api.iamport.kr/users/getToken",
            json={"imp_key": config.PORTONE_IMP_KEY, "imp_secret": config.PORTONE_IMP_SECRET},
        )
        if token_res.status_code != 200:
            raise HTTPException(500, "결제 서버 오류")
        access_token = token_res.json()["response"]["access_token"]

        # 결제 정보 조회
        payment_res = await client.get(
            f"https://api.iamport.kr/payments/{req.imp_uid}",
            headers={"Authorization": access_token},
        )
        if payment_res.status_code != 200:
            raise HTTPException(400, "결제 정보를 찾을 수 없습니다")

        payment = payment_res.json()["response"]
        if payment["status"] != "paid":
            raise HTTPException(400, "결제가 완료되지 않았습니다")
        if payment["amount"] != config.PREMIUM_PRICE:
            raise HTTPException(400, "결제 금액이 일치하지 않습니다")

    # 구독 등록
    expires = datetime.utcnow() + timedelta(days=30)
    await execute(
        "INSERT INTO subscriptions (user_id, plan, expires_at, imp_uid) VALUES (?, 'premium', ?, ?)",
        (user_id, expires.isoformat(), req.imp_uid),
    )
    return {"ok": True, "plan": "premium", "expires_at": expires.isoformat()}


@router.get("/status")
async def subscription_status(authorization: str = Header(None)):
    """구독 상태 조회"""
    user_id = get_user_id(authorization)
    sub = await fetch_one(
        "SELECT * FROM subscriptions WHERE user_id=? AND active=1 ORDER BY id DESC LIMIT 1",
        (user_id,),
    )
    if not sub:
        return {"plan": "free", "active": False}

    # 만료 확인
    if sub["expires_at"] and datetime.fromisoformat(sub["expires_at"]) < datetime.utcnow():
        await execute("UPDATE subscriptions SET active=0 WHERE id=?", (sub["id"],))
        return {"plan": "free", "active": False}

    return {"plan": sub["plan"], "active": True, "expires_at": sub["expires_at"]}


@router.get("/history")
async def reading_history(authorization: str = Header(None)):
    """상담 기록"""
    user_id = get_user_id(authorization)
    readings = await fetch_all(
        "SELECT * FROM readings WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        (user_id,),
    )
    return {"readings": readings}
