#!/bin/bash
# 터널 URL 감시자 설치 스크립트 (ZEMA-2620)
#
# tunnel-url-watcher.sh와 launchd plist를 설치한다.
# 런타임 워크스페이스 경로를 자동 감지하여 plist에 주입.
#
# 사용법: ./scripts/setup-tunnel-watcher.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔮 터널 URL 감시자 설치"
echo "================================"

# 런타임 워크스페이스 경로 감지 (백엔드 plist에서 추출)
RUNTIME_DIR="$PROJECT_DIR"
BACKEND_PLIST="$HOME/Library/LaunchAgents/com.taronyang.backend.plist"
if [ -f "$BACKEND_PLIST" ]; then
  DETECTED=$(grep -A1 'WorkingDirectory' "$BACKEND_PLIST" 2>/dev/null | grep '<string>' | sed 's/.*<string>\(.*\)<\/string>.*/\1/' | head -1 || true)
  if [ -n "$DETECTED" ]; then
    # WorkingDirectory는 backend/를 가리키므로 한 단계 위가 프로젝트 루트
    DETECTED=$(dirname "$DETECTED")
    RUNTIME_DIR="$DETECTED"
    echo "  런타임 워크스페이스 감지: $RUNTIME_DIR"
  fi
fi

WATCHER_SCRIPT="$RUNTIME_DIR/scripts/tunnel-url-watcher.sh"

if [ ! -f "$WATCHER_SCRIPT" ]; then
  echo "❌ 감시자 스크립트를 찾을 수 없음: $WATCHER_SCRIPT"
  exit 1
fi

chmod +x "$WATCHER_SCRIPT"

# launchd plist 생성 (실제 경로로 치환)
PLIST_PATH="$HOME/Library/LaunchAgents/com.taronyang.tunnel-watcher.plist"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-0.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taronyang.tunnel-watcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$WATCHER_SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/taronyang-tunnel-watcher.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/taronyang-tunnel-watcher.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
</dict>
</plist>
EOF

echo "  ✓ plist 생성: $PLIST_PATH"

# 기존 서비스 언로드 (오류 무시)
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# 서비스가 완전히 종료될 때까지 대기 (최대 5초)
for i in {1..10}; do
  if ! launchctl list 2>/dev/null | grep -q "com.taronyang.tunnel-watcher"; then
    break
  fi
  sleep 0.5
done

# 서비스 등록
launchctl load "$PLIST_PATH"
echo "  ✓ launchd 서비스 등록 완료"

# 상태 확인
sleep 2
PID=$(launchctl list 2>/dev/null | awk '$3 == "com.taronyang.tunnel-watcher" {print $1; exit}')
if [ -n "$PID" ] && [ "$PID" != "-" ]; then
  echo "  ✓ 서비스 실행 중 (PID: $PID)"
else
  echo "  ⚠️ 서비스가 아직 시작되지 않음 — 로그 확인: $HOME/Library/Logs/taronyang-tunnel-watcher.err"
fi

echo ""
echo "완료! 감시자는 60초마다 터널 URL 변경을 확인합니다."
echo "로그: tail -f $HOME/Library/Logs/taronyang-tunnel-watcher.log"
