# 🔮 타로냥 (TaroNyang)

AI 타로/운세 웹앱 서비스

## 구조

```
frontend/   → 정적 웹 (Cloudflare Pages 배포)
backend/    → FastAPI (Mac mini 로컬 실행)
shared/     → 공통 데이터 (타로카드 등)
```

## 개발

```bash
# 백엔드 실행
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드는 정적 파일 — 브라우저에서 직접 열거나 Live Server 사용
```

## 기술 스택

- Frontend: HTML/CSS/JS (Vanilla)
- Backend: FastAPI + SQLite
- LLM: Z.ai GLM API
- 인증: 소셜 로그인 + 이메일
- 결제: 포트원
