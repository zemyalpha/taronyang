import os
import sys
from dotenv import load_dotenv

# shared 패키지 경로 추가 (from shared.xxx 형식 지원)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

load_dotenv()

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Z.ai LLM
ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")
ZAI_API_URL = os.getenv("ZAI_API_URL", "https://api.z.ai/api/coding/paas/v4/chat/completions")
ZAI_MODEL = os.getenv("ZAI_MODEL", "glm-5")

# JWT
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", 7))

# Admin
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "").split(",")

# OAuth - Kakao
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI", "")

# OAuth - Naver
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
NAVER_REDIRECT_URI = os.getenv("NAVER_REDIRECT_URI", "")

# OAuth - Google
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")

# Email (Gmail SMTP)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# Tarot
FREE_DAILY_LIMIT = int(os.getenv("FREE_DAILY_LIMIT", 1))
MAX_CHAT_PER_READING = int(os.getenv("MAX_CHAT_PER_READING", 5))

# Payment (PortOne)
PORTONE_IMP_KEY = os.getenv("PORTONE_IMP_KEY", "")
PORTONE_IMP_SECRET = os.getenv("PORTONE_IMP_SECRET", "")

# Subscription
PREMIUM_PRICE = int(os.getenv("PREMIUM_PRICE", 9900))

# Database
DATABASE_PATH = os.getenv("DATABASE_PATH", "./taronyang.db")

# CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://192.168.0.87:8000")
