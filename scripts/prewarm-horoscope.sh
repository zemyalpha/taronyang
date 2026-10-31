#!/bin/bash
# Pre-warm daily horoscope cache for all 12 zodiac signs.
# Prevents cold-cache LLM latency (~20-50s) from causing Cloudflare tunnel
# timeouts for real users. Idempotent: cached signs return instantly.
# Triggered by com.taronyang.horoscope-prewarm.plist (daily 15:30 + 21:00 UTC).
set -u

LOG=/tmp/taronyang-prewarm.log
API="http://localhost:8000/api/notifications/horoscope"
SIGNS=(양자리 황소자리 쌍둥이자리 게자리 사자자리 처녀자리 천칭자리 전갈자리 사수자리 염소자리 물병자리 물고기자리)
CURL_TIMEOUT=150
INTER_SIGN_DELAY=5
RETRY_DELAY=15

echo "[$(date -u +%FT%TZ)] prewarm start" >> "$LOG"
ok=0; fail=0
failed_signs=()

for s in "${SIGNS[@]}"; do
  enc=$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$s" 2>/dev/null)
  code=$(curl -sS -m "${CURL_TIMEOUT}" -o /dev/null -w "%{http_code}" "${API}/${enc}" 2>>/tmp/taronyang-prewarm.err)
  [ -z "$code" ] && code="000"
  echo "[$(date -u +%FT%TZ)] ${s} -> ${code}" >> "$LOG"
  if [ "$code" = "200" ]; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    failed_signs+=("$s")
  fi
  sleep "${INTER_SIGN_DELAY}"
done

# Retry failed signs once after a cooldown (LLM rate-limit recovery)
if [ "${#failed_signs[@]}" -gt 0 ]; then
  echo "[$(date -u +%FT%TZ)] retrying ${#failed_signs[@]} failed signs after ${RETRY_DELAY}s cooldown" >> "$LOG"
  sleep "${RETRY_DELAY}"
  retried_ok=0
  for s in "${failed_signs[@]}"; do
    enc=$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$s" 2>/dev/null)
    code=$(curl -sS -m "${CURL_TIMEOUT}" -o /dev/null -w "%{http_code}" "${API}/${enc}" 2>>/tmp/taronyang-prewarm.err)
    [ -z "$code" ] && code="000"
    echo "[$(date -u +%FT%TZ)] ${s} (retry) -> ${code}" >> "$LOG"
    if [ "$code" = "200" ]; then
      ok=$((ok+1)); fail=$((fail-1)); retried_ok=$((retried_ok+1))
    fi
    sleep "${INTER_SIGN_DELAY}"
  done
  echo "[$(date -u +%FT%TZ)] retry recovered ${retried_ok}/${#failed_signs[@]}" >> "$LOG"
fi

echo "[$(date -u +%FT%TZ)] prewarm done ok=${ok} fail=${fail}" >> "$LOG"
