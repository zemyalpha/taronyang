#!/bin/bash
# Cloudflare Tunnel 설정 스크립트
# 사용법: ./setup-cloudflare-tunnel.sh [TUNNEL_NAME] [DOMAIN]
#
# 사전 요구사항:
#   1. cloudflared 설치: brew install cloudflared
#   2. Cloudflare 로그인: cloudflared tunnel login
#   3. 도메인의 DNS가 Cloudflare에 이미 연결되어 있어야 함
set -euo pipefail

TUNNEL_NAME="${1:-taronyang}"
DOMAIN="${2:-api.taronyang.com}"
LOCAL_URL="http://localhost:8000"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔮 타로냥 Cloudflare Tunnel 설정"
echo "================================"
echo "터널 이름: $TUNNEL_NAME"
echo "도메인: $DOMAIN"
echo "로컬 URL: $LOCAL_URL"
echo ""

if ! command -v cloudflared &>/dev/null; then
  echo "❌ cloudflared가 설치되어 있지 않습니다."
  echo "   설치: brew install cloudflared"
  exit 1
fi

if [ ! -f ~/.cloudflared/cert.pem ]; then
  echo "⚠️ Cloudflare 인증이 필요합니다."
  echo "   다음 명령으로 로그인하세요: cloudflared tunnel login"
  echo ""
  read -p "지금 로그인하시겠습니까? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cloudflared tunnel login
  else
    echo "로그인 후 다시 실행하세요."
    exit 1
  fi
fi

echo ""
echo "📝 터널 생성 중..."
TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1 | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' || true)

if [ -z "$TUNNEL_ID" ]; then
  echo "❌ 터널 생성 실패. 이미 존재하는지 확인하세요:"
  echo "   cloudflared tunnel list"
  exit 1
fi

echo "✅ 터널 생성됨: $TUNNEL_NAME (ID: $TUNNEL_ID)"

echo ""
echo "🌐 DNS 라우팅 설정 중..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" 2>/dev/null || {
  echo "⚠️ DNS 라우팅 실패. 수동으로 설정하세요:"
  echo "   cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN"
}

CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"

mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: $LOCAL_URL
  - service: http_status:404
EOF

echo "✅ 설정 파일 생성: $CONFIG_FILE"

LAUNCHD_PLIST="$PROJECT_DIR/com.taronyang.cloudflared.plist"
cat > "$LAUNCHD_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taronyang.cloudflared</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>run</string>
        <string>$TUNNEL_NAME</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/taronyang-cloudflared.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/taronyang-cloudflared.err</string>
</dict>
</plist>
EOF

echo "✅ launchd plist 생성: $LAUNCHD_PLIST"

echo ""
echo "설치 방법:"
echo "  cp $LAUNCHD_PLIST ~/Library/LaunchAgents/"
echo "  launchctl load ~/Library/LaunchAgents/com.taronyang.cloudflared.plist"
echo ""
echo "Cloudflare Pages 환경변수 설정:"
echo "  BACKEND_URL=https://$DOMAIN"
echo ""
echo "✅ 완료! 터널 테스트:"
echo "  cloudflared tunnel run $TUNNEL_NAME"
