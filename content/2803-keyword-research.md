# 한국어 타로 롱테일 키워드 갭 분석 2라운드 (ZEMA-2803)

> 작성일: 2026-06-28 · 작성자: Researcher Agent · 대상: CTO 구현 이관

## 1. 기존 커버리지 (중복 회피 대상 — 22개)

**기존 17개 포스트 + 1차 5개 = 총 22개 슬러그**

| 슬러그 | 커버 키워드 |
|--------|------------|
| career-fortune-tarot | 직장운·커리어운·취업운 |
| daily-tarot-fortune | 오늘의 타로·일일 운세 |
| free-tarot-reading-sites | 무료 타로 사이트 추천 |
| how-to-read-tarot-beginner | 타로 읽는 법·초보자 |
| love-fortune-tarot | 연애운·썸·기존 연인 |
| major-arcana-guide | 메이저 아르카나 22장 |
| minor-arcana-guide | 마이너 아르카나 56장 |
| money-fortune-tarot | 재물운·금전운 |
| taro-fortune-guide | 타로운세 보는 법 |
| tarot-card-meanings-guide | 카드 의미 총정리 |
| tarot-reverse-meaning | 역방향(리버스) 의미 |
| tarot-spreads-guide | 스프레드 배열법 |
| zodiac-tarot-compatibility | 별자리·궁합 |
| yes-no-tarot | 예스오아노·단답형 |
| reconciliation-fortune-tarot | 재회운·헤어진 사람 |
| tarot-question-guide | 질문 잘하는 법 |
| study-exam-fortune-tarot | 학업운·시험합격 |
| monthly-weekly-fortune-tarot | 월운세·주간운세 |

## 2. 갭 분석 — 2차로 커버되지 않은 롱테일 키워드

네이버 연관검색어·자동완성 패턴에서 위 22개가 담지 않는 고의도 키워드를 식별. 경쟁 강도는 타로 카테고리 내 상대값.

| 후보 키워드 | 검색 의도 | 추정 검색량 | 경쟁 | 기존 포스트와 차별 |
|------------|----------|------------|------|-------------------|
| **솔로운 타로 (언제 연애할까)** | 솔로탈출·인연 상봉 | 높음 | 중 | love(기존 연인)·재회(헤어진 사람)와 별개 — 미커버 최대 갭 |
| **타로 금기·주의사항** | 타로 보기 전 주의·금기일 | 중상 | 낮음 | 신뢰·권위 구축, 에버그린, 전환 깔때기 |
| **건강운 타로** | 건강·컨디션 회복 | 중 | 낮음 | 니치 에버그린, 경쟁 거의 없음 |
| **타로 덱 종류·추천 (라이더웨이트 등)** | 덱 구매·선택·종류 | 중상 | 중 | 권위 + 구매 의도, 미커버 |
| **타로 마스터 되는 법 (잘 보는 법)** | 실력 향상·리더 성장 | 중 | 낮음 | how-to-read(초보)와 단계 차이 — 숙련화 |
| 새해·신년운세 타로 | 연간 운세 (계절성) | 높음(1-3월) | 중 | 시즌성 강해 에버그린 우선순위에서 탈락 |
| 온라인 타로 추천 | 온라인 점 추천 | 중 | 중 | free-tarot-reading-sites와 중복 |
| 꿈해몽 타로 | 꿈 해몽 | 중 | 낮음 | 한국 니치 — 트래픽 한계 |
| 타로 결과 해석법 | 결과 읽기 | 중 | 낮음 | how-to-read·meanings-guide와 중복 |

## 3. 우선순위 Top 5 (선정 기준: 검색량·경쟁·전환·에버그린)

| 순위 | 키워드 | 포스트 슬러그 | 선정 사유 |
|------|--------|--------------|----------|
| 1 | **솔로운 타로** | `single-fortune-tarot` | 인간관계 카테고리 최대 갭. "언제 연애", "솔로탈출" 검색량 높고 감정적 의도强 → 체류·전환율 최상 |
| 2 | **타로 금기·주의사항** | `tarot-rules-and-precautions` | "타로 보는 날 주의사항" 고의도·저경쟁. 신뢰/권위 구축 + 리딩 전환 깔때기 |
| 3 | **건강운 타로** | `health-fortune-tarot` | 니치 에버그린. 경쟁 거의 없어 빠른 상위노출 기대 |
| 4 | **타로 덱 종류·추천** | `tarot-deck-guide` | "라이더웨이트", "타로덱 추천" 구매 의도. 권위 구축 + 이커머스 제휴 가능 |
| 5 | **타로 마스터 되는 법** | `how-to-master-tarot` | "타로 잘 보는 법" 저경쟁. how-to-read(초보) 다음 단계로 단계별 깔때기 완성 |

> 탈락: 새해운세(시즌성), 온라인 타로 추천(free-tarot-reading-sites 중복), 꿈해몽(니치 한계), 결과 해석법(how-to-read 중복)

## 4. 산출물

- 5개 HTML 초안: `content/2803-blog-drafts/*.html`
- 각 초안은 기존 `frontend/blog/yes-no-tarot.html` 템플릿 준수 (SEO 메타·JSON-LD Article+Breadcrumb·OG/Twitter·canonical·CTA·공유·푸터·별 배경)
- 내부 링크는 기존 `/cards/X-name.html` 및 `/blog/*.html` 포맷 사용
- datePublished/dateModified: 2026-06-28
