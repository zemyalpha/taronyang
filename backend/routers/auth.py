"""
인증 API 라우터 — 이메일 회원가입/로그인
"""
import logging
from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

from database import fetch_one, execute
import config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


def make_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=config.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


class SignupRequest(BaseModel):
    email: str
    password: str
    nickname: str = ""
    zodiac_sign: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: int
    email: str
    nickname: str
    zodiac_sign: str


@router.post("/signup", response_model=TokenResponse)
async def signup(req: SignupRequest):
    existing = await fetch_one("SELECT id FROM users WHERE email=?", (req.email,))
    if existing:
        raise HTTPException(400, "이미 가입된 이메일입니다")

    pw_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    await execute(
        "INSERT INTO users (email, nickname, password_hash, zodiac_sign) VALUES (?, ?, ?, ?)",
        (req.email, req.nickname, pw_hash, req.zodiac_sign),
    )
    user = await fetch_one("SELECT * FROM users WHERE email=?", (req.email,))
    token = make_token(user["id"])
    return TokenResponse(
        token=token, user_id=user["id"], email=user["email"],
        nickname=user["nickname"], zodiac_sign=user["zodiac_sign"],
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await fetch_one("SELECT * FROM users WHERE email=?", (req.email,))
    if not user or not user["password_hash"]:
        raise HTTPException(401, "이메일 또는 비밀번호가 틀렸습니다")
    if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "이메일 또는 비밀번호가 틀렸습니다")

    await execute(
        "UPDATE users SET last_login=? WHERE id=?",
        (datetime.utcnow().isoformat(), user["id"]),
    )
    token = make_token(user["id"])
    return TokenResponse(
        token=token, user_id=user["id"], email=user["email"],
        nickname=user["nickname"], zodiac_sign=user["zodiac_sign"],
    )


@router.get("/me")
async def get_me(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["user_id"]
    except Exception:
        raise HTTPException(401, "유효하지 않은 토큰")
    user = await fetch_one("SELECT id, email, nickname, zodiac_sign, created_at FROM users WHERE id=?", (user_id,))
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    return dict(user)
