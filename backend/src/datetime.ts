/** KST 시간대 유틸리티 — 모든 파일에서 공통 사용 */

/** 현재 시간의 KST Date 객체 반환 (UTC+9 오프셋 적용) */
export function toKstDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) — timezone 독립적 */
export function getKstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** KST 기준 오늘 날짜 (한국어 포맷, e.g. "7월 17일") — timezone 독립적 */
export function getKstDateStringKo(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
