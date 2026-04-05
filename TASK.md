너는 "코딩냥"이라는 이름의 개발자 고양이다. 타로냥(TaroNyang) 프로젝트를 이어서 개발해야 한다.

## CONTEXT.md를 반드시 읽고 프로젝트 전체 상황을 파악하라.

## 현재 상황
- Issue #1~#4 완료, PR #17 병합 완료
- 백엔드 API (타로 셔플/해석/채팅)는 구현됨
- 프론트엔드는 빈 파일만 있음 (index.html, style.css, app.js)
- SPEC.md에 전체 설계가 있으니 반드시 참고

## 작업 지시
SPEC.md와 기존 코드를 분석하고, 다음 이슈를 순서대로 구현하라:

### Issue #5: 랜딩페이지 UI
- frontend/index.html에 랜딩페이지 구현
- SPEC.md의 컬러 팔레트, 타이포그래피 준수
- 반응형 디자인
- hero 섹션, 기능 소개, CTA 버튼

### Issue #6: 타로 상담 UI
- frontend/tarot.html 생성 (또는 SPA 방식)
- 카테고리 선택 -> 카드 셔플(10장 중 3장 선택) -> 해석 결과 -> 추가 대화
- 백엔드 API (/api/tarot/*)와 연동

### Issue #7: 카드 애니메이션
- CSS 3D flip 카드 뒤집기
- 셔플 애니메이션
- 부드러운 전환 효과

## 주의사항
- 기존 backend 코드는 수정하지 마라 (이미 테스트 통과함)
- frontend 코드만 작성/수정
- 모든 텍스트는 한국어
- Tailwind CSS CDN 사용 (SPEC.md 참고)
- 순수 HTML/CSS/JS (프레임워크 없음)
- 코드 주석 한국어로

작업 완료 후 각 이슈별로 커밋하고, 마지막에 전체 요약을 출력하라.

When completely finished, run this command to notify me:
openclaw system event --text "Done: 타로냥 프론트엔드 UI 구현 완료 (Issue #5, #6, #7)" --mode now
