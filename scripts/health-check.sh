#!/bin/bash
# 타로냥 헬스체크 스크립트
# launchd (com.taronyang.monitor)에서 5분마다 실행 (StartInterval 300)
#
# 점검 항목:
#   1. 백엔드 로컬 헬스체크 (http://localhost:8000/api/health)
#   2. cloudflared 터널 프로세스 실행 여부
#   3. 퍼블릭 터널 URL 접근성
#      - PUBLIC_URL 환경변수가 있으면 해당 도메인 사용 (named tunnel 전환 후)
#      - 없으면 터널 로그에서 quick tunnel URL 동적 추출
#
# 환경변수 (선택):
#   LOCAL_URL       백엔드 로컬 주소 (기본: http://localhost:8000)
#   TUNNEL_LOG      터널 로그 경로 (기본: /tmp/taronyang-tunnel.log)
#   PUBLIC_URL      퍼블릭 도메인 명시 (예: https://api.taronyang.app)
#   HEALTH_TIMEOUT  curl 타임아웃 초 (기본: 10)
#
# 종료 코드:
#   0 = 모든 항목 정상
#   1 = 하나 이상의 항목 실패 (launchctl 목록에 실패 상태로 표시됨)
#
# 사용법:
#   ./scripts/health-check.sh
#   PUBLIC_URL=https://api.taronyang.app ./scripts/health-check.sh
set -uo pipefail

LOCAL_URL="${LOCAL_URL:-http://localhost:8000}"
TUNNEL_LOG="${TUNNEL_LOG:-/tmp/taronyang-tunnel.err}"
PUBLIC_URL="${PUBLIC_URL:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-10}"

FAIL_COUNT=0
log_ok()   { echo "✅ $1"; }
log_warn() { echo "⚠️  $1"; }
log_fail() { echo "❌ $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 타로냥 헬스체크 시작"
echo "----------------------------------------"

# ─── 1. 백엔드 로컬 헬스체크 ───
if HEALTH_RESP=$(curl -sf --connect-timeout 5 --max-time "$HEALTH_TIMEOUT" "$LOCAL_URL/api/health" 2>/dev/null); then
  log_ok "백엔드 헬스체크 정상 ($LOCAL_URL/api/health): $HEALTH_RESP"
else
  log_fail "백엔드 헬스체크 실패 — $LOCAL_URL/api/health 응답 없음 (launchctl kickstart gui/\$(id -u)/com.taronyang.backend 확인)"
fi

# ─── 2. cloudflared 터널 프로세스 확인 ───
if TUNNEL_PID=$(launchctl list | awk '/com.taronyang.tunnel/ {print $1; exit}') && [ -n "$TUNNEL_PID" ]; then
  log_ok "cloudflared 터널 실행 중 (launchd PID: $TUNNEL_PID)"
else
  log_fail "com.taronyang.tunnel 서비스 미실행 — 터널 다운 (launchctl kickstart gui/\$(id -u)/com.taronyang.tunnel 확인)"
fi

# ─── 3. 퍼블릭 URL 접근성 ───
# PUBLIC_URL 명시 (named tunnel) = 권위 검증 (실패 시 치명)
# PUBLIC_URL 미지정 시 터널 로그에서 quick tunnel URL 동적 추출 (참고용, 실패 시 경고)
URL_EXPLICIT=1
if [ -z "$PUBLIC_URL" ]; then
  URL_EXPLICIT=0
  if [ -f "$TUNNEL_LOG" ]; then
    PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1)
  fi
fi

if [ -z "$PUBLIC_URL" ]; then
  log_warn "퍼블릭 URL 확인 불가 — 터널 로그에서 URL을 찾을 수 없음 ($TUNNEL_LOG)"
elif curl -sf --connect-timeout 5 --max-time "$HEALTH_TIMEOUT" "$PUBLIC_URL/api/health" >/dev/null 2>&1; then
  log_ok "퍼블릭 URL 접근 가능 ($PUBLIC_URL/api/health)"
elif [ "$URL_EXPLICIT" -eq 1 ]; then
  log_fail "퍼블릭 URL 접근 실패 ($PUBLIC_URL/api/health) — DNS 전파 또는 터널 상태 확인"
else
  log_warn "퍼블릭 URL 접근 실패 ($PUBLIC_URL/api/health) — quick tunnel URL이 만료되었을 수 있음 (named tunnel 전환 권장, [ZEMA-2558](/ZEMA/issues/ZEMA-2558))"
fi

echo "----------------------------------------"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 헬스체크 통과 (모든 항목 정상)"
  exit 0
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 헬스체크 실패 (${FAIL_COUNT}개 항목 이상)"
  exit 1
fi
