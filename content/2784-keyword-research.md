# 한국어 타로 롱테일 키워드 갭 분석 (ZEMA-2784)

> 작성일: 2026-06-27 · 작성자: Researcher Agent · 대상: CTO 구현 이관

## 1. 기존 12개 포스트 커버리지

| 포스트 | 커버 키워드 |
|--------|------------|
| career-fortune-tarot | 직장운·커리어운·취업운 타로 |
| daily-tarot-fortune | 오늘의 타로운세·일일 운세 |
| free-tarot-reading-sites | 무료 타로 사이트 추천 |
| how-to-read-tarot-beginner | 타로 읽는 법·초보자 가이드 |
| love-fortune-tarot | 연애운·썸·연인 카드 |
| major-arcana-guide | 메이저(대) 아르카나 |
| minor-arcana-guide | 마이너(소) 아르카나 |
| money-fortune-tarot | 재물운·금전운 타로 |
| taro-fortune-guide | 타로운세 보는 법 |
| tarot-card-meanings-guide | 타로카드 의미 총정리 |
| tarot-reverse-meaning | 타로 역방향(리버스) 의미 |
| tarot-spreads-guide | 타로 스프레드 배열법 |
| zodiac-tarot-compatibility | 별자리·궁합 타로 |

## 2. 갭 분석 — 커버되지 않은 롱테일 키워드

한국 타로 검색 행태(네이버 연관검색어·자동완성 패턴 기준)에서 위 12개가 담지 않는 고의도 키워드를 식별했다. 경쟁 강도는 타로 카테고리 내 상대값.

| 후보 키워드 | 검색 의도 | 추정 검색량 | 경쟁 | 기존 포스트와 차별 |
|------------|----------|------------|------|-------------------|
| **타로 예스오아노 (Yes or No 타로)** | 단답형 예/아니오 점 | 높음 | 중 | 전용 없음 — 즉시 리딩 전환 |
| **재회운 타로 (헤어진 사람 다시)** | 재회·짝사랑 복귀 | 높음 | 중 | love-fortune이 터치만 함 |
| **타로 질문 잘하는 법** | 좋은 질문 작성법 | 중상 | 낮음 | how-to-read는 '읽기'만 |
| **학업운·시험합격 타로** | 수능·공시 합격운 | 중상 | 낮음 | career는 직장, 학업 미커버 |
| **월운세·주간운세 타로** | 월간/주간 반복 방문 | 중상 | 중 | daily는 일일만 |
| 새해·신년운세 타로 | 연간 운세 (계절성) | 높음(계절) | 중 | 시즌성 강해 우선순위 낮음 |
| 타로카드 종류·덱 추천 | 덱 구매·선택 | 중 | 중 | 권위 구축용 |
| 건강운 타로 | 건강·컨디션 | 중 | 낮음 | 니치 |
| 꿈해몽 타로 | 꿈 해몽 | 중 | 낮음 | 한국 특화 니치 |

## 3. 우선순위 Top 5 (선정 기준: 검색량·경쟁·전환·에버그린)

| 순위 | 키워드 | 포스트 슬러그 | 선정 사유 |
|------|--------|--------------|----------|
| 1 | **타로 예스오아노** | `yes-no-tarot` | 가장 흔한 단답형 검색, 즉시 무료 리딩 전환, 에버그린 |
| 2 | **재회운 타로** | `reconciliation-fortune-tarot` | 감정적 의도 강해 체류시간 길고 전환율 높음 |
| 3 | **타로 질문 잘하는 법** | `tarot-question-guide` | 경쟁 낮음·리딩 전 직 단계 보조, 전환 깔때기 역할 |
| 4 | **학업운·시험합격 타로** | `study-exam-fortune-tarot` | 한국 수험생 시장, 경쟁 낮음, 에버그린 |
| 5 | **월운세·주간운세 타로** | `monthly-weekly-fortune-tarot` | 재방문 유도, recurring 트래픽 |

## 4. 산출물

- 5개 HTML 초안: `content/2784-blog-drafts/*.html`
- 각 초안은 기존 `frontend/blog/love-fortune-tarot.html` 템플릿을 준수 (SEO 메타·JSON-LD·OG·canonical·CTA·공유·푸터)
- 내부 링크는 기존 `/cards/X-name.html` 및 `/blog/*.html` 포맷 사용
