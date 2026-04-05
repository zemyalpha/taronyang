"""포트원(아임포트) 결제 연동"""
import os
import httpx
import json
import logging
from datetime import datetime, timedelta
from db.database import get_db

logger = logging.getLogger(__name__)

PORTONE_IMP_KEY = os.getenv("PORTONE_IMP_KEY", "")
PORTONE_IMP_SECRET = os.getenv("PORTONE_IMP_SECRET", "")
PREMIUM_PRICE = int(os.getenv("PREMIUM_PRICE", 9900))


async def get_portone_token() -> str:
    """포트원 API 토큰 발급"""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            "https://api.iamport.kr/users/getToken",
            json={"imp_key": PORTONE_IMP_KEY, "imp_secret": PORTONE_IMP_SECRET}
        )
        data = res.json()
        if data.get("code") != 0:
            raise Exception(f"포트원 토큰 발급 실패: {data.get('message')}")
        return data["response"]["access_token"]


async def verify_payment(imp_uid: str) -> dict:
    """결제 검증"""
    token = await get_portone_token()
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"https://api.iamport.kr/payments/{imp_uid}",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        if data.get("code") != 0:
            raise Exception(f"결제 조회 실패: {data.get('message')}")

        payment = data["response"]
        # 검증: 금액, 상태
        if payment["amount"] != PREMIUM_PRICE:
            raise Exception(f"결제 금액 불일치: {payment['amount']} != {PREMIUM_PRICE}")
        if payment["status"] != "paid":
            raise Exception(f"결제 상태 이상: {payment['status']}")

        return {
            "imp_uid": payment["imp_uid"],
            "merchant_uid": payment["merchant_uid"],
            "amount": payment["amount"],
            "status": payment["status"],
            "buyer_email": payment.get("buyer_email", ""),
        }


def activate_premium(user_id: str, months: int = 1):
    """프리미엄 구독 활성화"""
    conn = get_db()
    expires = datetime.utcnow() + timedelta(days=30 * months)
    conn.execute(
        "UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?",
        (expires.isoformat(), user_id)
    )
    conn.commit()
    conn.close()
    logger.info("프리미엄 활성화: user=%s, expires=%s", user_id, expires)


def check_subscription(user_id: str) -> str:
    """구독 상태 확인"""
    conn = get_db()
    user = conn.execute("SELECT subscription_status, subscription_expires_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return "free"
    if user["subscription_status"] == "premium" and user["subscription_expires_at"]:
        if datetime.fromisoformat(user["subscription_expires_at"]) < datetime.utcnow():
            # 만료 → 무료로 전환
            conn = get_db()
            conn.execute("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?", (user_id,))
            conn.commit()
            conn.close()
            return "free"
        return "premium"
    return "free"
