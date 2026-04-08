# 타로냥 (TaroNyang) 개발 컨텍스트

## 중요 규칙
1. **모든 코드 주석과 커밋 메시지는 한국어로 작성**
2. **실수 방지:** 기존 코드를 수정할 때는 기존 구조를 존중할 것
3. **테스트 필수:** 각 기능 구현 후 반드시 테스트 코드 작성
4. **디자인 가이드 준수:** SPEC.md의 컬러/폰트/레이아웃 엄격히 따를 것
5. **LLM API:** Z.ai GLM API 사용 (엔드포인트: https://api.z.ai/api/coding/paas/v4/chat/completions)
6. **한국어 UI:** 모든 사용자 대면 텍스트는 한국어
7. **타로냥 캐릭터:** "~냥", "~해요" 말투, 따뜻하고 공감력 높은 톤

## 기술 스택
- **백엔드:** Express + TypeScript (Node.js)
- **프론트엔드:** 정적 HTML (8페이지)
- **DB:** SQLite (better-sqlite3)
- **LLM:** Z.ai GLM API
- **배포:** Railway

## 현재 완료된 작업
- ✅ Issue #1: 프로젝트 초기 설정 (모노레포, Express + TypeScript)
- ✅ Issue #2: 타로카드 78장 데이터 (backend/src/tarotData.ts)
- ✅ Issue #3/#4: LLM 프롬프트 설계 + Z.ai API 연동 + 타로 API 라우터
- ✅ 백엔드 빌드 성공 (dist/ 존재)
- ✅ 프론트엔드 정적 HTML 8페이지 (index, tarot, daily, history, mypage, login, pricing, admin)
- ✅ Express 라우팅 설정 (모든 페이지 서빙)

## 현재 코드 구조
```
taronyang/
├── frontend/
│   ├── index.html          (랜딩페이지)
│   ├── tarot.html          (타로 상담)
│   ├── daily.html          (오늘의 운세)
│   ├── history.html        (상담 기록)
│   ├── mypage.html         (마이페이지)
│   ├── login.html          (로그인)
│   ├── pricing.html        (요금제)
│   ├── admin/              (관리자)
│   ├── css/                (스타일시트)
│   └── js/                 (클라이언트 스크립트)
├── backend/
│   ├── src/
│   │   ├── index.ts        (Express 앱 진입점, CORS, 정적파일 서빙)
│   │   ├── config.ts       (환경변수 설정)
│   │   ├── database.ts     (SQLite 초기화)
│   │   ├── llm.ts          (Z.ai GLM API 클라이언트)
│   │   ├── tarotData.ts    (78장 카드 데이터)
│   │   ├── tarotPrompt.ts  (프롬프트 템플릿)
│   │   ├── dailyNotify.ts  (데일리 알림 스케줄러)
│   │   └── routes/
│   │       ├── tarot.ts    (타로 API)
│   │       ├── auth.ts     (인증 API)
│   │       ├── readings.ts (상담 기록 API)
│   │       ├── payment.ts  (결제 API)
│   │       ├── admin.ts    (관리자 API)
│   │       └── notify.ts   (알림 API)
│   ├── dist/               (빌드 결과물)
│   ├── package.json
│   └── tsconfig.json
├── shared/                 (공유 리소스)
├── Procfile                (Railway 프로세스 설정)
├── railway.json            (Railway 빌드/배포 설정)
├── CONTEXT.md              (이 파일)
├── DEPLOY.md               (배포 가이드)
├── SPEC.md                 (전체 설계 문서)
└── .env.example
```

## 다음 해야 할 작업 (우선순위 순)
1. 프론트엔드 UI 구현 (SPEC.md 디자인 가이드 기반)
2. 카드 애니메이션 (CSS flip, 셔플)
3. OAuth 연동 (카카오, 네이버, 구글)
4. 결제 연동 (포트원)

## 기존 실수 및 주의사항
- frontend/index.html은 아직 거의 비어있음 → SPEC.md 디자인 가이드 참고해서 구현
- CSS 컬러: 딥네이비 #0a0a2e, 라벤더퍼플 #a78bfa, 골드 #fbbf24
- 폰트: Noto Serif KR (타이틀) + Noto Sans KR (본문)
- dotenv로 backend/.env 파일에서 환경변수 로드

## API 엔드포인트 (이미 구현됨)
- GET /api/health — 헬스체크
- GET /api/tarot/categories — 카테고리 목록
- GET /api/tarot/shuffle?count=10 — 카드 셔플
- POST /api/tarot/read — 타로 해석
- POST /api/tarot/chat — 추가 대화
- POST /api/auth/* — 인증 관련
- GET /api/readings/* — 상담 기록
- POST /api/payment/* — 결제
- GET /api/admin/* — 관리자
- GET /api/notifications/* — 알림
