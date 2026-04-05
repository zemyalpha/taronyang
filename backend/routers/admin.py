"""관리자 API 라우터"""
import logging
from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db.database import get_db, get_user_by_id
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user=Depends(get_current_user)):
    """관리자 권한 확인"""
    if not user.get("is_admin"):
        raise HTTPException(403, "관리자 권한이 필요합니다")
    return user


@router.get("/stats")
async def get_stats(_=Depends(require_admin)):
    """대시보드 통계"""
    conn = get_db()
    total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    premium_users = conn.execute("SELECT COUNT(*) FROM users WHERE subscription_status = 'premium'").fetchone()[0]
    today_users = conn.execute("SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')").fetchone()[0]
    total_readings = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    today_readings = conn.execute("SELECT COUNT(*) FROM readings WHERE date(created_at) = date('now')").fetchone()[0]
    conn.close()

    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "free_users": total_users - premium_users,
        "today_new_users": today_users,
        "total_readings": total_readings,
        "today_readings": today_readings,
    }


@router.get("/users")
async def list_users(page: int = 1, limit: int = 20, _=Depends(require_admin)):
    """사용자 목록"""
    conn = get_db()
    offset = (page - 1) * limit
    rows = conn.execute(
        "SELECT id, email, nickname, provider, subscription_status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset)
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return {
        "users": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/readings")
async def list_readings_admin(page: int = 1, limit: int = 20, _=Depends(require_admin)):
    """전체 상담 기록"""
    conn = get_db()
    offset = (page - 1) * limit
    rows = conn.execute(
        "SELECT r.id, r.category, r.question, r.created_at, u.email, u.nickname FROM readings r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?",
        (limit, offset)
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    conn.close()
    return {
        "readings": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, _=Depends(require_admin)):
    """사용자 삭제"""
    conn = get_db()
    conn.execute("DELETE FROM readings WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
