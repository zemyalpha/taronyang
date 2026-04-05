"""인증 API 라우터"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from db.database import create_user, verify_user, get_user_by_id
from services.auth_service import create_jwt, verify_jwt
from services.oauth_service import get_oauth_urls, kakao_callback, naver_callback, google_callback, find_or_create_oauth_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- Pydantic Models ---

class SignupRequest(BaseModel):
    email: str
    password: str
    nickname: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    nickname: str
    provider: str
    subscription_status: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse


# --- 의존성 ---

def get_current_user(request: Request):
    """JWT에서 현재 사용자 추출"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    payload = verify_jwt(auth[7:])
    if not payload:
        raise HTTPException(401, "토큰이 만료되었거나 유효하지 않습니다")
    user = get_user_by_id(payload.get("user_id"))
    if not user:
        raise HTTPException(401, "사용자를 찾을 수 없습니다")
    return user


# --- 엔드포인트 ---

@router.post("/signup", response_model=TokenResponse)
async def signup(req: SignupRequest):
    """이메일 회원가입"""
    if len(req.password) < 6:
        raise HTTPException(400, "비밀번호는 6자 이상이어야 합니다")
    if len(req.email) < 3 or "@" not in req.email:
        raise HTTPException(400, "올바른 이메일을 입력해주세요")

    # 중복 확인
    from db.database import get_user_by_email
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(409, "이미 가입된 이메일입니다")

    user = create_user(req.email, req.password, req.nickname)
    if not user:
        raise HTTPException(500, "회원가입에 실패했습니다")

    token = create_jwt({"user_id": user["id"]})
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            nickname=user["nickname"],
            provider=user["provider"],
            subscription_status=user["subscription_status"],
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """이메일 로그인"""
    user = verify_user(req.email, req.password)
    if not user:
        raise HTTPException(401, "이메일 또는 비밀번호가 일치하지 않습니다")

    token = create_jwt({"user_id": user["id"]})
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            nickname=user["nickname"],
            provider=user["provider"],
            subscription_status=user["subscription_status"],
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """내 정보 조회"""
    return UserResponse(
        id=user["id"],
        email=user["email"],
        nickname=user["nickname"],
        provider=user["provider"],
        subscription_status=user["subscription_status"],
    )


@router.put("/me", response_model=UserResponse)
async def update_me(request: Request, user=Depends(get_current_user)):
    """내 정보 수정"""
    body = await request.json()
    nickname = body.get("nickname")
    birth_date = body.get("birth_date")

    from db.database import get_db
    conn = get_db()
    updates = []
    params = []
    if nickname:
        updates.append("nickname = ?")
        params.append(nickname)
    if birth_date:
        updates.append("birth_date = ?")
        params.append(birth_date)
        # 별자리 자동 계산
        zodiac = _calc_zodiac(birth_date)
        if zodiac:
            updates.append("zodiac_sign = ?")
            params.append(zodiac)
    if updates:
        params.append(user["id"])
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()

    updated = get_user_by_id(user["id"])
    return UserResponse(
        id=updated["id"],
        email=updated["email"],
        nickname=updated["nickname"],
        provider=updated["provider"],
        subscription_status=updated["subscription_status"],
    )


def _calc_zodiac(birth_date: str) -> str | None:
    """생일로 별자리 계산"""
    try:
        month = int(birth_date.split("-")[1])
        day = int(birth_date.split("-")[2])
        if (month == 3 and day >= 21) or (month == 4 and day <= 19):
            return "양자리"
        elif (month == 4 and day >= 20) or (month == 5 and day <= 20):
            return "황소자리"
        elif (month == 5 and day >= 21) or (month == 6 and day <= 21):
            return "쌍둥이자리"
        elif (month == 6 and day >= 22) or (month == 7 and day <= 22):
            return "게자리"
        elif (month == 7 and day >= 23) or (month == 8 and day <= 22):
            return "사자자리"
        elif (month == 8 and day >= 23) or (month == 9 and day <= 23):
            return "처녀자리"
        elif (month == 9 and day >= 24) or (month == 10 and day <= 22):
            return "천칭자리"
        elif (month == 10 and day >= 23) or (month == 11 and day <= 22):
            return "전갈자리"
        elif (month == 11 and day >= 23) or (month == 12 and day <= 24):
            return "궁수자리"
        elif (month == 12 and day >= 25) or (month == 1 and day <= 19):
            return "염소자리"
        elif (month == 1 and day >= 20) or (month == 2 and day <= 18):
            return "물병자리"
        elif (month == 2 and day >= 19) or (month == 3 and day <= 20):
            return "물고기자리"
    except Exception:
        pass
    return None


# --- OAuth 엔드포인트 ---

@router.get("/oauth/urls")
async def oauth_urls():
    """소셜 로그인 URL 목록"""
    return get_oauth_urls()


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str, state: str = ""):
    """소셜 로그인 콜백"""
    if provider == "kakao":
        info = await kakao_callback(code)
    elif provider == "naver":
        info = await naver_callback(code)
    elif provider == "google":
        info = await google_callback(code)
    else:
        raise HTTPException(400, f"지원하지 않는 로그인 방식: {provider}")

    if not info:
        raise HTTPException(400, "소셜 로그인에 실패했습니다")

    user = find_or_create_oauth_user(info)
    token = create_jwt({"user_id": user["id"]})

    # 프론트엔드로 리다이렉트 (토큰 전달)
    from fastapi.responses import RedirectResponse
    import urllib.parse
    params = urllib.parse.urlencode({"token": token, "user_id": user["id"], "nickname": user["nickname"]})
    return RedirectResponse(url=f"/static/login.html?oauth=1&{params}")
