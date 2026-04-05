"""결제 API 라우터"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from routers.auth import get_current_user
from services.payment_service import verify_payment, activate_premium, check_subscription, PREMIUM_PRICE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payment", tags=["payment"])


class VerifyRequest(BaseModel):
    imp_uid: str


class SubscriptionStatus(BaseModel):
    status: str
    expires_at: str | None = None


@router.get("/price")
async def get_price():
    """요금 정보"""
    return {
        "premium_price": PREMIUM_PRICE,
        "currency": "KRW",
        "interval": "monthly",
    }


@router.post("/verify")
async def verify_and_activate(req: VerifyRequest, user=Depends(get_current_user)):
    """결제 검증 후 프리미엄 활성화"""
    try:
        payment = await verify_payment(req.imp_uid)
        activate_premium(user["id"])
        return {"ok": True, "message": "프리미엄이 활성화되었습니다! ✨"}
    except Exception as e:
        logger.error("결제 검증 실패: %s", e)
        raise HTTPException(400, str(e))


@router.get("/status", response_model=SubscriptionStatus)
async def subscription_status(user=Depends(get_current_user)):
    """구독 상태 확인"""
    from db.database import get_db
    conn = get_db()
    row = conn.execute("SELECT subscription_status, subscription_expires_at FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()

    status = check_subscription(user["id"])
    return SubscriptionStatus(
        status=status,
        expires_at=dict(row)["subscription_expires_at"] if row else None,
    )


@router.post("/cancel")
async def cancel_subscription(user=Depends(get_current_user)):
    """구독 취소 (기간 끝나면 자동 만료)"""
    from db.database import get_db
    conn = get_db()
    # 만료일까지는 유지, 자동갱신 해제
    conn.execute("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "구독이 만료 후 취소됩니다."}
