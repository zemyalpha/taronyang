"""소셜 로그인 서비스 (카카오, 네이버, 구글)"""
import os
import httpx
from db.database import get_db

# 카카오
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI", "http://localhost:8000/api/auth/oauth/kakao/callback")

# 네이버
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
NAVER_REDIRECT_URI = os.getenv("NAVER_REDIRECT_URI", "http://localhost:8000/api/auth/oauth/naver/callback")

# 구글
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/oauth/google/callback")


def get_oauth_urls():
    """소셜 로그인 URL 반환"""
    urls = {}
    if KAKAO_CLIENT_ID:
        urls["kakao"] = (
            f"https://kauth.kakao.com/oauth/authorize?"
            f"client_id={KAKAO_CLIENT_ID}&redirect_uri={KAKAO_REDIRECT_URI}"
            f"&response_type=code&scope=profile_nickname,account_email"
        )
    if NAVER_CLIENT_ID:
        import urllib.parse
        state = "taronyang_naver"
        urls["naver"] = (
            f"https://nid.naver.com/oauth2.0/authorize?"
            f"client_id={NAVER_CLIENT_ID}&redirect_uri={NAVER_REDIRECT_URI}"
            f"&response_type=code&state={state}"
        )
    if GOOGLE_CLIENT_ID:
        import urllib.parse
        scope = urllib.parse.quote("openid email profile")
        urls["google"] = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={GOOGLE_CLIENT_ID}&redirect_uri={GOOGLE_REDIRECT_URI}"
            f"&response_type=code&scope={scope}&access_type=offline"
        )
    return urls


async def kakao_callback(code: str) -> dict:
    """카카오 콜백 → 사용자 정보"""
    async with httpx.AsyncClient(timeout=10) as client:
        # 토큰 교환
        token_res = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": KAKAO_CLIENT_ID,
                "client_secret": KAKAO_CLIENT_SECRET,
                "redirect_uri": KAKAO_REDIRECT_URI,
                "code": code,
            }
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None

        # 사용자 정보
        user_res = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_data = user_res.json()

        kakao_account = user_data.get("kakao_account", {})
        profile = kakao_account.get("profile", {})
        return {
            "provider": "kakao",
            "provider_id": str(user_data.get("id", "")),
            "email": kakao_account.get("email", ""),
            "nickname": profile.get("nickname", ""),
        }


async def naver_callback(code: str) -> dict:
    """네이버 콜백 → 사용자 정보"""
    async with httpx.AsyncClient(timeout=10) as client:
        token_res = await client.post(
            "https://nid.naver.com/oauth2.0/token",
            data={
                "grant_type": "authorization_code",
                "client_id": NAVER_CLIENT_ID,
                "client_secret": NAVER_CLIENT_SECRET,
                "redirect_uri": NAVER_REDIRECT_URI,
                "code": code,
                "state": "taronyang_naver",
            }
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None

        user_res = await client.get(
            "https://openapi.naver.com/v1/nid/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_data = user_res.json()
        response = user_data.get("response", {})
        return {
            "provider": "naver",
            "provider_id": response.get("id", ""),
            "email": response.get("email", ""),
            "nickname": response.get("nickname", ""),
        }


async def google_callback(code: str) -> dict:
    """구글 콜백 → 사용자 정보"""
    async with httpx.AsyncClient(timeout=10) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "authorization_code",
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "code": code,
            }
        )
        token_data = token_res.json()
        id_token = token_data.get("id_token")
        if not id_token:
            return None

        # ID 토큰 디코딩 (간이 버전 — 실제 운영은 google-auth 라이브러리 권장)
        import base64
        import json
        parts = id_token.split(".")
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        return {
            "provider": "google",
            "provider_id": payload.get("sub", ""),
            "email": payload.get("email", ""),
            "nickname": payload.get("name", ""),
        }


def find_or_create_oauth_user(info: dict) -> dict:
    """소셜 계정으로 기존 사용자 찾기 또는 생성"""
    import uuid

    conn = get_db()
    # provider + provider_id로 찾기
    row = conn.execute(
        "SELECT * FROM users WHERE provider = ? AND provider_id = ?",
        (info["provider"], info["provider_id"])
    ).fetchone()

    if row:
        conn.close()
        return dict(row)

    # 이메일로 기존 계정 찾기 (병합)
    if info.get("email"):
        row = conn.execute("SELECT * FROM users WHERE email = ?", (info["email"],)).fetchone()
        if row:
            # 기존 계정에 provider 정보 업데이트
            conn.execute(
                "UPDATE users SET provider = ?, provider_id = ? WHERE id = ?",
                (info["provider"], info["provider_id"], row["id"])
            )
            conn.commit()
            conn.close()
            return dict(row)

    # 새 사용자 생성
    user_id = str(uuid.uuid4())
    nickname = info.get("nickname") or info.get("email", "").split("@")[0]
    conn.execute(
        "INSERT INTO users (id, provider, provider_id, email, nickname) VALUES (?, ?, ?, ?, ?)",
        (user_id, info["provider"], info["provider_id"], info.get("email"), nickname)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row)
