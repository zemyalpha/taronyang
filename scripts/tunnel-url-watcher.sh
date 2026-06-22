#!/bin/bash
# 터널 URL 감시 스크립트 (ZEMA-2620)
#
# Cloudflare Quick Tunnel URL 변경을 감지하고 api-beacon.json을 자동 업데이트.
# launchd(com.taronyang.tunnel-watcher.plist)를 통해 60초마다 실행됨.
#
# 동작:
#   1. cloudflared 로그에서 현재 trycloudflare.com URL 추출
#   2. api-beacon.json과 비교
#   3. URL이 변경된 경우 beacon 파일 업데이트 + git push
#   4. GitHub Actions가 자동으로 Pages 재배포
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BEACON_FILE="$PROJECT_DIR/api-beacon.json"
TUNNEL_ERR_LOG="$HOME/Library/Logs/taronyang-tunnel.err"
TUNNEL_OUT_LOG="$HOME/Library/Logs/taronyang-tunnel.log"

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

# 메인 로직
CURRENT_URL=$(extract_tunnel_url)
BEACON_URL=$(read_beacon_url)

if [ -z "$CURRENT_URL" ]; then
  # 터널 URL을 찾을 수 없음 — 종료 (다음 실행에서 재시도)
  exit 0
fi

# URL이 동일하면 변경 없음
if [ "$CURRENT_URL" = "$BEACON_URL" ]; then
  exit 0
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 터널 URL 변경 감지:"
echo "  이전: ${BEACON_URL:-<없음>}"
echo "  현재: $CURRENT_URL"

# 비컨 파일 업데이트
CURRENT_URL="$CURRENT_URL" BEACON_FILE="$BEACON_FILE" python3 -c "
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
echo "  ✓ api-beacon.json 업데이트 완료"

# git에 커밋 및 푸시
cd "$PROJECT_DIR"

# 런타임 워크스페이스가 main 브랜치인지 확인
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$BRANCH" != "main" ]; then
  echo "  ⚠️ 런타임 워크스페이스가 main이 아님 (현재: $BRANCH). 스킵."
  exit 0
fi

# 푸시되지 않은 로컬 커밋이 있는지 확인하고 있으면 푸시 시도
if git status -sb 2>/dev/null | grep -q 'ahead'; then
  echo "  ⚠️ 푸시되지 않은 로컬 커밋이 존재합니다. 푸시를 재시도합니다."
  if git push origin main 2>/dev/null; then
    echo "  ✓ 푸시 성공"
  else
    echo "  ❌ 푸시 실패 — 다음 실행에서 재시도"
    exit 0
  fi
fi

# 변경사항 커밋
git add api-beacon.json
git commit -m "chore: update tunnel URL beacon (auto)

Co-Authored-By: Paperclip <noreply@paperclip.ing>" 2>/dev/null || {
  echo "  ⚠️ 커밋 실패 (이미 최신이거나 권한 없음)"
  exit 0
}

# 로컬 변경사항 임시 보관 (커밋된 상태이므로 stash 불필요)
# 원격 저장소와 결정론적 동기화 후 푸시
if git push origin main 2>/dev/null; then
  echo "  ✓ GitHub로 푸시 완료 — Pages 자동 재배포 예정"
else
  echo "  ⚠️ 푸시 실패 — 다음 실행에서 재시도"
fi
