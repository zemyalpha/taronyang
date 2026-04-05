"""상담 기록 API 라우터"""
import json
import logging
from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from db.database import get_db, get_user_by_id
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/readings", tags=["readings"])


class ReadingResponse(BaseModel):
    id: str
    category: str
    question: Optional[str]
    cards_drawn: str
    interpretation: str
    created_at: str


def save_reading(user_id: str | None, category: str, question: str, cards: list, interpretation: str) -> str:
    """상담 기록 저장"""
    import uuid
    reading_id = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (reading_id, user_id, category, question, json.dumps(cards, ensure_ascii=False), "[]", interpretation)
    )
    conn.commit()
    conn.close()
    return reading_id


def check_free_limit(user_id: str | None) -> bool:
    """무료 횟수 확인 (로그인 유저: 하루 1회, 비회원: 항상 가능 but 제한적)"""
    if not user_id:
        return True  # 비회원은 일단 통과 (나중에 IP/UUID 제한)
    
    today = str(date.today())
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return False
    
    # 프리미엄은 무제한
    if user["subscription_status"] == "premium":
        conn.close()
        return True
    
    # 무료 플랜: 날짜가 바뀌면 카운트 리셋
    if user["free_reset_date"] != today:
        conn.execute("UPDATE users SET free_count_today = 0, free_reset_date = ? WHERE id = ?", (today, user_id))
        conn.commit()
        conn.close()
        return True
    
    # 오늘 카운트 확인 (1회 무료)
    if user["free_count_today"] >= 1:
        conn.close()
        return False
    
    conn.close()
    return True


def increment_free_count(user_id: str | None):
    """무료 카운트 증가"""
    if not user_id:
        return
    conn = get_db()
    conn.execute("UPDATE users SET free_count_today = free_count_today + 1 WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()


@router.get("", response_model=list[ReadingResponse])
async def list_readings(user=Depends(get_current_user)):
    """내 상담 기록 목록"""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (user["id"],)
    ).fetchall()
    conn.close()
    return [ReadingResponse(**dict(r)) for r in rows]


@router.get("/{reading_id}", response_model=ReadingResponse)
async def get_reading(reading_id: str, user=Depends(get_current_user)):
    """상담 기록 상세"""
    conn = get_db()
    row = conn.execute(
        "SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE id = ? AND user_id = ?",
        (reading_id, user["id"])
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "기록을 찾을 수 없습니다")
    return ReadingResponse(**dict(row))


@router.delete("/{reading_id}")
async def delete_reading(reading_id: str, user=Depends(get_current_user)):
    """상담 기록 삭제"""
    conn = get_db()
    conn.execute("DELETE FROM readings WHERE id = ? AND user_id = ?", (reading_id, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}
