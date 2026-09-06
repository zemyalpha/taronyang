#!/bin/bash
# 터널 URL 감시 스크립트 (ZEMA-2620, ZEMA-3747)
#
# Cloudflare Quick Tunnel URL 변경을 감지하고 api-beacon.json을 자동 업데이트.
# launchd(com.taronyang.tunnel-watcher.plist)를 통해 60초마다 실행됨.
#
# 동작:
#   1. cloudflared 로그에서 현재 trycloudflare.com URL 추출
#   2. origin/main의 beacon URL과 비교 (로컬 파일이 아님 — 푸시 실패 재시도 보장)
#   3. URL이 변경된 경우: 로컬 beacon 갱신 + 임시 detached worktree에서
#      origin/main 기준 커밋 후 push (런타임 클론의 체크아웃 브랜치/dirty
#      상태와 무관하게 동작 — prod-branch-lock watchdog과 충돌하지 않음)
#   4. GitHub Actions가 자동으로 Pages 재배포
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BEACON_FILE="$PROJECT_DIR/api-beacon.json"
TUNNEL_ERR_LOG="${TUNNEL_ERR_LOG:-/tmp/taronyang-tunnel.err}"
TUNNEL_OUT_LOG="${TUNNEL_OUT_LOG:-/tmp/taronyang-tunnel.log}"

# 현재 터널 URL 추출 (stderr 우선, stdout 폴백)
extract_tunnel_url() {
  local url=""
  # stderr에서 가장 최근 URL 추출
  if [ -f "$TUNNEL_ERR_LOG" ]; then
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_ERR_LOG" 2>/dev/null | tail -1 || true)
  fi
  # stdout 폴백
  if [ -z "$url" ] && [ -f "$TUNNEL_OUT_LOG" ]; then
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_OUT_LOG" 2>/dev/null | tail -1 || true)
  fi
  echo "$url"
}

# 비컨 파일에서 현재 저장된 URL 읽기
read_beacon_url() {
  if [ ! -f "$BEACON_FILE" ]; then
    echo ""
    return
  fi
  BEACON_FILE="$BEACON_FILE" python3 -c "
import os, json
try:
    with open(os.environ['BEACON_FILE']) as f:
        data = json.load(f)
    print(data.get('apiUrl', ''))
except:
    print('')
" 2>/dev/null || echo ""
}

# 비컨 JSON 파일 작성 (인자: 대상 파일 경로)
write_beacon() {
  CURRENT_URL="$CURRENT_URL" BEACON_FILE="$1" python3 -c "
import os, json
from datetime import datetime, timezone
data = {
    'apiUrl': os.environ['CURRENT_URL'],
    'source': 'tunnel-quick',
    'updatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'note': 'Quick Tunnel URL — 자동 업데이트됨 (tunnel-url-watcher.sh)'
}
with open(os.environ['BEACON_FILE'], 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
"
}

# 로컬 비컨 파일 갱신
update_local_beacon() {
  write_beacon "$BEACON_FILE"
}

# 메인 로직
CURRENT_URL=$(extract_tunnel_url)
BEACON_URL=$(read_beacon_url)

if [ -z "$CURRENT_URL" ]; then
  # 터널 URL을 찾을 수 없음 — 종료 (다음 실행에서 재시도)
  exit 0
fi

# git 상태 조회 — 푸시 성공 여부와 무관하게 수렴하도록 원격 main 기준으로 판단한다.
# (로컬 파일 기준 조기 종료는 푸시 실패 시 재시도를 영원히 막는 버그의 원인이었다.)
cd "$PROJECT_DIR"
git worktree prune 2>/dev/null || true

if ! git fetch origin main --quiet 2>/dev/null; then
  # fetch 실패 시 로컬 beacon만이라도 동기화해 두고 다음 실행에서 재시도
  if [ "$CURRENT_URL" != "$BEACON_URL" ]; then
    update_local_beacon
  fi
  echo "  ⚠️ git fetch 실패 — 다음 실행에서 재시도"
  exit 0
fi

REMOTE_URL=$(git show origin/main:api-beacon.json 2>/dev/null | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('apiUrl', ''))
except:
    print('')
" 2>/dev/null || echo "")

# 원격 main이 이미 최신 URL이면 완료 (로컬 파일만 갱신)
if [ "$REMOTE_URL" = "$CURRENT_URL" ]; then
  if [ "$CURRENT_URL" != "$BEACON_URL" ]; then
    update_local_beacon
  fi
  exit 0
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 터널 URL 변경 감지:"
echo "  이전(원격): ${REMOTE_URL:-<없음>}"
echo "  현재: $CURRENT_URL"

# 로컬 비컨 파일 업데이트
update_local_beacon
echo "  ✓ api-beacon.json 업데이트 완료"

# 원격 main 기준 임시 detached worktree에서 커밋/푸시
# (fetch와 REMOTE_URL 비교는 위에서 완료됨)
TMP_WT=$(mktemp -d /tmp/taronyang-beacon-wt.XXXXXX)
cleanup_worktree() {
  git worktree remove --force "$TMP_WT" >/dev/null 2>&1 || rm -rf "$TMP_WT"
}
trap cleanup_worktree EXIT

if ! git worktree add --quiet --detach "$TMP_WT" origin/main; then
  echo "  ❌ 임시 worktree 생성 실패 — 다음 실행에서 재시도"
  exit 0
fi

# worktree에 beacon 작성
write_beacon "$TMP_WT/api-beacon.json"

# 커밋 (기계 생성 JSON 단일 파일 — 무인 런타임 환경 보장을 위해 hook 미실행)
if ! git -C "$TMP_WT" add api-beacon.json 2>/dev/null; then
  echo "  ❌ git add 실패 — 다음 실행에서 재시도"
  exit 0
fi
if ! git -C "$TMP_WT" --no-pager commit --no-verify -m "chore: update tunnel URL beacon (auto)

Co-Authored-By: Paperclip <noreply@paperclip.ing>" >/dev/null 2>&1; then
  echo "  ⚠️ 커밋 실패 (이미 최신이거나 권한 없음) — 다음 실행에서 재시도"
  exit 0
fi

# 푸시 (비-fast-forward면 실패 → 다음 실행에서 fetch 후 재시도)
if git -C "$TMP_WT" push origin HEAD:main --quiet 2>/dev/null; then
  echo "  ✓ GitHub로 푸시 완료 — Pages 자동 재배포 예정"
else
  echo "  ⚠️ 푸시 실패 — 다음 실행에서 재시도"
fi
