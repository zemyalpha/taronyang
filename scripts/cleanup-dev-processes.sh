#!/bin/bash
# 좀비 ts-node-dev 프로세스 정리 스크립트
# launchd (com.taronyang.dev-cleanup)에서 주기적으로 실행
#
# 목적:
#   에이전트/QA 세션에서 시작 후 종료되지 않은 ts-node-dev 프로세스를 감지하여
#   프로덕션 백엔드(node dist/index.js)의 EADDRINUSE 크래시를 방지.
#
# 안전성:
#   - 프로덕션(node dist/index.js)은 절대 종료하지 않음
#   - MAX_AGE_HOURS(기본 6시간) 이상 실행된 ts-node-dev만 종료
#   - 활성 개발 세션(6시간 미만)은 보호
#
# 환경변수:
#   MAX_AGE_HOURS  종료 임계 실행시간 (기본: 6)
#   DRY_RUN        1이면 실제 종료하지 않고 후보만 출력
#
# 종료 코드:
#   0 = 정상 (좀비 없음 또는 정리 완료)
#   1 = 스크립트 오류
set -uo pipefail

MAX_AGE_HOURS="${MAX_AGE_HOURS:-6}"
DRY_RUN="${DRY_RUN:-0}"
LOG_PREFIX="[dev-cleanup $(date '+%Y-%m-%dT%H:%M:%S')]"

# 프로덕션 백엔드 PID (com.taronyang.backend launchd 잡)
PROD_PID=$(launchctl list | awk '$3 == "com.taronyang.backend" {print $1; exit}')
PROD_PID="${PROD_PID:-0}"

# ts-node-dev 좀비 후보 수집 (taronyang 경로 한정)
# ps etime 형식: "DD-HH:MM:SS" 또는 "MM:SS" 또는 "HH:MM:SS"
CANDIDATES=$(pgrep -f 'ts-node-dev.*taronyang' 2>/dev/null || true)

KILLED=0
SPARED=0

if [ -z "$CANDIDATES" ]; then
  echo "$LOG_PREFIX 좀비 ts-node-dev 프로세스 없음 — 정상"
else
echo "$LOG_PREFIX 후보 스캔 시작 (MAX_AGE_HOURS=$MAX_AGE_HOURS, DRY_RUN=$DRY_RUN, prod PID=$PROD_PID)"

for PID in $CANDIDATES; do
  # 프로덕션 PID와 충돌 방지 (안전장치)
  if [ "$PID" = "$PROD_PID" ]; then
    echo "$LOG_PREFIX 경고: PID $PID = 프로덕션 백엔드 — 건너뜀"
    continue
  fi

  # 실행 시간 파싱 (etime 필드)
  ETIME=$(ps -o etime= -p "$PID" 2>/dev/null | tr -d ' ')
  if [ -z "$ETIME" ]; then
    continue
  fi

  # etime → 시간 단위 변환
  # 형식: "DD-HH:MM:SS", "HH:MM:SS", "MM:SS"
  TOTAL_HOURS=0
  if [[ "$ETIME" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
    DAYS=$(( ${BASH_REMATCH[1]} ))
    HOURS=$(( ${BASH_REMATCH[2]} ))
    TOTAL_HOURS=$(( DAYS * 24 + HOURS ))
  elif [[ "$ETIME" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
    TOTAL_HOURS=$(( ${BASH_REMATCH[1]} ))
  else
    # MM:SS 형식 — 1시간 미만
    TOTAL_HOURS=0
  fi

  CMD=$(ps -o command= -p "$PID" 2>/dev/null | cut -c1-80)

  if [ "$TOTAL_HOURS" -ge "$MAX_AGE_HOURS" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      echo "$LOG_PREFIX DRY-RUN: PID $PID (${ETIME}h=${TOTAL_HOURS}h) 종료 후보 — $CMD"
    else
      kill -TERM "$PID" 2>/dev/null
      sleep 3
      if kill -0 "$PID" 2>/dev/null; then
        kill -KILL "$PID" 2>/dev/null
      fi
      echo "$LOG_PREFIX 종료: PID $PID (${TOTAL_HOURS}h 실행) — $CMD"
    fi
    KILLED=$((KILLED + 1))
  else
    SPARED=$((SPARED + 1))
  fi
done

echo "$LOG_PREFIX 프로세스 정리 완료: 종료=$KILLED, 보호=$SPARED"
fi

# ─── 로그 로테이션 (/tmp/taronyang-backend.{log,err}) ───
# 임계치 초과 시 마지막 1000라인만 유지 (crash 루프 등으로 인한 무한 증식 방지)
LOG_MAX_LINES="${LOG_MAX_LINES:-50000}"
ROTATED=0
for LOGFILE in /tmp/taronyang-backend.err /tmp/taronyang-backend.log /tmp/taronyang-monitor.out /tmp/taronyang-tunnel.err /tmp/taronyang-cot-guard.log; do
  if [ -f "$LOGFILE" ]; then
    LINES=$(wc -l < "$LOGFILE" 2>/dev/null || echo 0)
    if [ "$LINES" -gt "$LOG_MAX_LINES" ]; then
      tail -1000 "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE"
      echo "$LOG_PREFIX 로그 로테이션: $LOGFILE ($LINES → 1000 라인)"
      ROTATED=$((ROTATED + 1))
    fi
  fi
done
if [ "$ROTATED" -gt 0 ]; then
  echo "$LOG_PREFIX 로그 로테이션 완료: ${ROTATED}개 파일"
fi

exit 0
