/** KST 시간대 유틸리티 — 모든 파일에서 공통 사용 */

/** KST 오프셋 (UTC+9) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 현재 시간의 KST Date 객체 반환 */
export function toKstDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function getKstDateString(date: Date = new Date()): string {
  return toKstDate(date).toISOString().slice(0, 10);
}
