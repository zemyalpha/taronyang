#!/bin/bash
# 타로냥 스테이징 헬스 모니터링 스크립트
# launchd(com.taronyang.monitor)에서 5분마다 실행
#
# 확인 항목:
#   1. 백엔드 헬스 엔드포인트 (http://localhost:8000/api/health)
#   2. cloudflared 터널 프로세스 생존 여부
#   3. (선택) 공개 스테이징 URL 응답 — URL 파일이 있을 때만
set -uo pipefail

LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/taronyang-monitor.log"
MAX_LOG_SIZE=$((1024 * 1024))   # 1MB
MAX_LOG_LINES=5000             # 약 7일치 (5분 간격)
HEALTH_URL="http://localhost:8000/api/health"
STAGING_URL_FILE="$HOME/.taronyang-staging-url"

mkdir -p "$LOG_DIR"

# --- 주간 로그 로테이션 (크기 기반) ---
if [ -f "$LOG_FILE" ]; then
  FILE_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$FILE_SIZE" -gt "$MAX_LOG_SIZE" ]; then
    tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
  fi
fi

TS=$(date '+%Y-%m-%d %H:%M:%S')
FAIL_COUNT=0
STATUS_LINE=""

# --- 1. 백엔드 헬스 체크 ---
HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  STATUS_LINE="backend=OK(200)"
else
  STATUS_LINE="backend=FAIL($HTTP_CODE)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# --- 2. cloudflared 프로세스 체크 ---
if pgrep -f 'cloudflared' > /dev/null 2>&1; then
  STATUS_LINE="$STATUS_LINE tunnel=OK"
else
  STATUS_LINE="$STATUS_LINE tunnel=DOWN"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# --- 3. (선택) 공개 URL 체크 ---
if [ -f "$STAGING_URL_FILE" ]; then
  PUBLIC_URL=$(cat "$STAGING_URL_FILE" | tr -d '[:space:]')
  if [ -n "$PUBLIC_URL" ]; then
    PUB_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 15 "$PUBLIC_URL/api/health" 2>/dev/null || echo "000")
    if [ "$PUB_CODE" = "200" ]; then
      STATUS_LINE="$STATUS_LINE public=OK(200)"
    else
      STATUS_LINE="$STATUS_LINE public=FAIL($PUB_CODE)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
fi

# --- 로그 출력 ---
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "[$TS] ✅ $STATUS_LINE" >> "$LOG_FILE"
else
  echo "[$TS] ❌ $STATUS_LINE ($FAIL_COUNT failures)" >> "$LOG_FILE"
  # 장애 시 터미널에도 출력 (launchd 로그와 이중 기록)
  echo "[$TS] ❌ $STATUS_LINE ($FAIL_COUNT failures)" >&2
fi

exit 0
