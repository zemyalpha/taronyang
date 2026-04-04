# 🔮 타로냥 (TaroNyang) — 전체 설계 문서

## 프로젝트 개요
- AI 타로/운세 웹앱 서비스
- 정적 프론트엔드 (Cloudflare Pages) + FastAPI 백엔드 (Mac mini)
- 운영비용 ₩0/월

## 아키텍처

```
[Cloudflare Pages] (정적 웹)
       ↓ ↑ API
[Mac mini FastAPI] (API + DB)
       ↓ ↑
[Z.ai GLM API] (LLM)
```

## 기술 스택

| 구성 | 기술 |
|------|------|
| 프론트엔드 | 순수 HTML/CSS/JS (정적) |
| UI | Tailwind CSS (CDN) |
| 카드 애니메이션 | CSS + Vanilla JS |
| 백엔드 | FastAPI (Python) |
| DB | SQLite |
| 인증 | 소셜 로그인 (카카오/네이버/구글) + 이메일 |
| 결제 | 포트원 (아임포트) |
| 알림 | 이메일 (Gmail SMTP) |
| 호스팅 | Cloudflare Pages + Mac mini |
| LLM | Z.ai GLM API (coding plan) |
| 카드 이미지 | 무료 공개 타로카드 + SVG 아이콘 |

## 컬러 팔레트

| 용도 | 색상 | 코드 |
|------|------|------|
| 배경 기본 | 딥 네이비 | #0a0a2e |
| 배경 카드 | 다크 퍼플 | #1a1a3e |
| 포인트 메인 | 라벤더 퍼플 | #a78bfa |
| 포인트 보조 | 골드 | #fbbf24 |
| 텍스트 기본 | 화이트 | #f8fafc |
| 텍스트 보조 | 라이트 그레이 | #94a3b8 |
| 긍정 | 소프트 그린 | #86efac |
| 부정 | 소프트 레드 | #fca5a5 |
| CTA 버튼 | 퍼플 그라데이션 | #7c3aed → #a78bfa |

## 타이포그래피
- 타이틀: Noto Serif KR (Google Fonts)
- 본문: Noto Sans KR (Google Fonts)

## 페이지 목록

| 경로 | 페이지 |
|------|--------|
| / | 랜딩페이지 |
| /tarot | 타로 상담 (카테고리→카드선택→해석→대화) |
| /tarot/result/:id | 상담 결과 (공유 가능) |
| /daily | 오늘의 운세 |
| /history | 상담 기록 |
| /login | 로그인/회원가입 |
| /mypage | 마이페이지 |
| /pricing | 요금제 |
| /admin | 관리자 대시보드 |
| /admin/users | 사용자 관리 |
| /admin/readings | 상담 기록 관리 |
| /admin/subscriptions | 구독 관리 |
| /admin/settings | 서비스 설정 |

## 사용자 흐름

```
랜딩 → 카테고리 선택 → 카드 3장 선택 → 카드 뒤집기(애니메이션)
→ AI 해석 → 추가 대화(최대 5회) → 공유/저장/다시하기
```

## 인증

### 소셜 로그인
- 카카오 (OAuth2)
- 네이버 (OAuth2)
- 구글 (OAuth2)

### 이메일 회원가입
- 이메일 + 비밀번호 (bcrypt)
- JWT 토큰 (7일 만료)

### 비회원
- localStorage UUID로 익명 사용자 생성
- 로그인 시 익명 데이터 계정으로 병합

## 수익 모델

| 플랜 | 가격 | 기능 |
|------|------|------|
| 무료 | ₩0 | 매일 1회, 기본 해석 |
| 프리미엄 | ₩9,900/월 | 무제한, 상세 해석, 추가 대화, 일운 알림 |

## 알림 (구독자)
- 매일 아침 7시 (설정 가능: 6/7/8/9시)
- 이메일 발송 (Phase 1)
- 별자리/생일 기반 개인화

## DB 스키마

### users
- id (PK, UUID)
- provider (email/kakao/naver/google)
- provider_id
- email (UNIQUE)
- password_hash
- nickname
- birth_date (선택)
- zodiac_sign
- created_at
- free_count_today
- free_reset_date
- subscription_status (free/premium)
- subscription_expires_at
- settings (JSON: notification_enabled, notification_time)

### readings
- id (PK)
- user_id (FK)
- category (love/money/career/general)
- question
- cards_drawn (JSON)
- card_positions (JSON)
- interpretation (TEXT)
- created_at
- rating (nullable)

### daily_horoscopes
- id (PK)
- user_id (FK)
- date
- card_name
- card_position
- summary
- scores (JSON)
- lucky_color
- lucky_number
- full_reading (TEXT)
- email_sent (bool)
- created_at

## 디렉토리 구조

```
taronyang/
├── frontend/
│   ├── index.html
│   ├── tarot.html
│   ├── daily.html
│   ├── history.html
│   ├── login.html
│   ├── mypage.html
│   ├── pricing.html
│   ├── admin/
│   │   ├── index.html
│   │   ├── users.html
│   │   ├── readings.html
│   │   ├── subscriptions.html
│   │   └── settings.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── tarot.js
│   │   ├── auth.js
│   │   └── admin.js
│   └── assets/
│       ├── cards/ (78장 이미지)
│       └── icons/ (SVG)
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── tarot.py
│   │   ├── daily.py
│   │   ├── user.py
│   │   ├── payment.py
│   │   └── admin.py
│   ├── services/
│   │   ├── llm.py
│   │   ├── tarot_cards.py
│   │   ├── tarot_prompt.py
│   │   ├── auth_service.py
│   │   └── email_service.py
│   ├── db/
│   │   ├── database.py
│   │   └── models.py
│   ├── middleware/
│   │   └── auth.py
│   └── requirements.txt
├── shared/
│   └── tarot_data.py (78장 카드 데이터)
├── .env.example
├── .gitignore
└── README.md
```

## 개발 마일스톤

### Phase 1: 기본 구조 (3일)
- [ ] 프로젝트 초기 설정 (모노레포, FastAPI, 정적 파일)
- [ ] 타로카드 78장 데이터
- [ ] LLM 프롬프트 설계
- [ ] 기본 API (카드 셔플, 해석)

### Phase 2: 프론트엔드 (4일)
- [ ] 랜딩페이지
- [ ] 타로 상담 UI (카테고리→카드선택→해석)
- [ ] 카드 애니메이션 (CSS flip)
- [ ] 추가 대화 UI
- [ ] 오늘의 운세 페이지

### Phase 3: 인증 (3일)
- [ ] 이메일 회원가입/로그인
- [ ] 카카오 소셜 로그인
- [ ] 네이버 소셜 로그인
- [ ] 구글 소셜 로그인
- [ ] JWT 인증 미들웨어

### Phase 4: 사용자 기능 (2일)
- [ ] 무료 횟수 제한
- [ ] 상담 기록 저장/조회
- [ ] 마이페이지

### Phase 5: 결제 (3일)
- [ ] 포트원 연동
- [ ] 구독 관리
- [ ] 요금제 페이지

### Phase 6: 알림 (2일)
- [ ] 일운 생성 (LLM)
- [ ] 이메일 발송 (APScheduler)
- [ ] 알림 설정

### Phase 7: 관리자 (2일)
- [ ] 관리자 대시보드
- [ ] 사용자/상담/구독 관리
- [ ] 서비스 설정

### Phase 8: 배포 (2일)
- [ ] Cloudflare Pages 배포
- [ ] Mac mini API 서비스 등록
- [ ] 도메인 연결
- [ ] 모니터링
