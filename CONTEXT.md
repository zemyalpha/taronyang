# 타로냥 (TaroNyang) 개발 컨텍스트

## 중요 규칙
1. **모든 코드 주석과 커밋 메시지는 한국어로 작성**
2. **실수 방지:** 기존 코드를 수정할 때는 기존 구조를 존중할 것
3. **테스트 필수:** 각 기능 구현 후 반드시 테스트 코드 작성
4. **디자인 가이드 준수:** SPEC.md의 컬러/폰트/레이아웃 엄격히 따를 것
5. **LLM API:** Z.ai GLM API 사용 (엔드포인트: https://api.z.ai/api/coding/paas/v4/chat/completions)
6. **한국어 UI:** 모든 사용자 대면 텍스트는 한국어
7. **타로냥 캐릭터:** "~냥", "~해요" 말투, 따뜻하고 공감력 높은 톤

## 현재 완료된 작업
- ✅ Issue #1: 프로젝트 초기 설정 (모노레포, FastAPI, 기본 파일)
- ✅ Issue #2: 타로카드 78장 데이터 (shared/tarot_data.py)
- ✅ Issue #3/#4: LLM 프롬프트 설계 + Z.ai API 연동 + 타로 API 라우터
- ✅ Issue #17 (PR): 코드 리뷰 반영 및 수정 (MERGED)

## 현재 코드 구조
```
taronyang/
├── frontend/
│   ├── index.html          (기본 HTML만 있음, 아직 UI 없음)
│   ├── css/style.css       (빈 파일)
│   └── js/app.js           (빈 파일)
├── backend/
│   ├── main.py             (FastAPI 앱, CORS, 정적파일 서빙)
│   ├── config.py           (환경변수 설정)
│   ├── routers/tarot.py    (타로 API: 카테고리, 셔플, 해석, 채팅)
│   ├── services/llm.py     (Z.ai GLM API 클라이언트)
│   ├── services/tarot_prompt.py (프롬프트 템플릿)
│   └── tests/test_tarot.py
├── shared/
│   └── tarot_data.py       (78장 카드 데이터 + get_card 함수)
├── SPEC.md                 (전체 설계 문서)
└── .env.example
```

## 다음 해야 할 작업 (우선순위 순)
1. **Issue #5:** 랜딩페이지 UI (frontend/index.html)
2. **Issue #6:** 타로 상담 UI (카테고리→카드선택→해석)
3. **Issue #7:** 카드 애니메이션 (CSS flip, 셔플)
4. **Issue #8:** 오늘의 운세 페이지

## 기존 실수 및 주의사항
- backend/main.py에서 `from routers import tarot` 사용 → 상대경로 아님
- config.py에서 `sys.path.insert`로 shared 패키지 경로 추가
- frontend/index.html은 아직 거의 비어있음 → SPEC.md 디자인 가이드 참고해서 구현
- CSS 컬러: 딥네이비 #0a0a2e, 라벤더퍼플 #a78bfa, 골드 #fbbf24
- 폰트: Noto Serif KR (타이틀) + Noto Sans KR (본문)

## API 엔드포인트 (이미 구현됨)
- GET /api/tarot/categories — 카테고리 목록
- GET /api/tarot/shuffle?count=10 — 카드 셔플
- POST /api/tarot/read — 타로 해석
- POST /api/tarot/chat — 추가 대화
- GET /api/health — 헬스체크
