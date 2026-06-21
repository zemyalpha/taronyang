#!/bin/bash
# 타로냥 프로덕션 배포 스크립트 — Quick Tunnel → Named Tunnel + Cloudflare Pages
#
# 사용법: ./scripts/deploy-production.sh [API_DOMAIN] [FRONTEND_PROJECT_NAME]
# 예시:   ./scripts/deploy-production.sh api.taronyang.app taronyang
#
# 사전 요구사항:
#   1. cloudflared 설치: brew install cloudflared
#   2. wrangler 설치: npm install -g wrangler
#   3. 보드 승인 완료 (Cloudflare 계정 접근 권한)
#   4. 도메인의 DNS가 Cloudflare에 연결되어 있어야 함
#   5. 백엔드가 localhost:8000에서 실행 중이어야 함
set -euo pipefail

TUNNEL_NAME="taronyang"
API_DOMAIN="${1:-api.taronyang.app}"
PAGES_PROJECT="${2:-taronyang}"
LOCAL_URL="http://localhost:8000"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CF_DIR="$HOME/.cloudflared"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }
step()  { echo ""; echo -e "${GREEN}━━━ $1 ━━━${NC}"; }

echo "🔮 타로냥 프로덕션 배포"
echo "================================"
echo "터널 이름: $TUNNEL_NAME"
echo "API 도메인: $API_DOMAIN"
echo "Pages 프로젝트: $PAGES_PROJECT"
echo "로컬 URL: $LOCAL_URL"
echo ""

# ─── 사전 검증 ───
step "1/7 — 사전 검증"

command -v cloudflared &>/dev/null || error "cloudflared가 설치되어 있지 않습니다. 설치: brew install cloudflared"
info "cloudflared 확인"

command -v wrangler &>/dev/null || error "wrangler가 설치되어 있지 않습니다. 설치: npm install -g wrangler"
info "wrangler 확인"

curl -sf "$LOCAL_URL/api/health" &>/dev/null || error "백엔드가 $LOCAL_URL에서 응답하지 않습니다. launchctl load 확인 필요"
info "백엔드 헬스체크 OK"

# ─── Cloudflare 인증 ───
step "2/7 — Cloudflare 인증"

if [ ! -f "$CF_DIR/cert.pem" ]; then
    warn "Cloudflare 인증이 필요합니다."
    echo "   브라우저가 열립니다. 도메인을 선택하여 인증하세요."
    cloudflared tunnel login
fi
info "cloudflared 인증 확인"

# wrangler 로그인 상태 확인
if ! wrangler whoami &>/dev/null 2>&1; then
    warn "wrangler 로그인이 필요합니다."
    wrangler login
fi
info "wrangler 인증 확인"

# ─── Named Tunnel 생성 ───
step "3/7 — Named Tunnel 생성"

# 기존 터널 확인
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk -v name="$TUNNEL_NAME" '$2 == name {print $1}' || true)

if [ -n "$TUNNEL_ID" ]; then
    info "터널이 이미 존재합니다: $TUNNEL_NAME ($TUNNEL_ID)"
else
    echo "📝 새 터널 생성 중..."
    CREATE_OUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1) || error "터널 생성 실패: $CREATE_OUT"
    TUNNEL_ID=$(echo "$CREATE_OUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' || true)
    [ -n "$TUNNEL_ID" ] || error "터널 생성 실패"
    info "터널 생성됨: $TUNNEL_NAME (ID: $TUNNEL_ID)"
fi

# ─── DNS 라우팅 ───
step "4/7 — DNS 라우팅 설정"

echo "🌐 $API_DOMAIN → 터널 연결 중..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$API_DOMAIN" 2>/dev/null && info "DNS 라우팅 완료" || warn "DNS 라우팅 실패 — 수동 확인 필요: cloudflared tunnel route dns $TUNNEL_NAME $API_DOMAIN"

# ─── Tunnel Config 파일 ───
step "5/7 — Tunnel Config 및 launchd 전환"

mkdir -p "$CF_DIR"
cat > "$CF_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CF_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $API_DOMAIN
    service: $LOCAL_URL
  - service: http_status:404
EOF
info "Config 파일 생성: $CF_DIR/config.yml"

# Named Tunnel용 launchd plist 경로 (unload + create 일관성을 위해 상단에서 정의)
PLIST_PATH="$HOME/Library/LaunchAgents/com.taronyang.tunnel.plist"

# 기존 Tunnel 서비스 언로드 (등록되었지만 비활성 상태도 커버하기 위해 무조건 실행)
echo "🔄 기존 Tunnel 서비스 언로드 중..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
info "기존 Tunnel 서비스 언로드 완료"

# Named Tunnel용 launchd plist 생성 및 등록 (~/Library/LaunchAgents에 직접 작성)
CLOUDFLARED_PATH=$(command -v cloudflared) || error "cloudflared 경로를 찾을 수 없습니다"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taronyang.tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>$CLOUDFLARED_PATH</string>
        <string>tunnel</string>
        <string>run</string>
        <string>$TUNNEL_NAME</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/taronyang-tunnel.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/taronyang-tunnel.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF
info "Named Tunnel plist 생성: $PLIST_PATH"

launchctl load "$PLIST_PATH"
sleep 3
info "Named Tunnel 시작됨"

# ─── Cloudflare Pages 배포 ───
step "6/7 — Cloudflare Pages 프론트엔드 배포"

cd "$PROJECT_DIR/frontend"

# Pages 프로젝트 생성 (이미 존재하면 스킵, 그 외 실패는 즉시 중단)
if CREATE_PROJECT_OUT=$(wrangler pages project create "$PAGES_PROJECT" --production-branch main 2>&1); then
    info "Pages 프로젝트 생성: $PAGES_PROJECT"
else
    if echo "$CREATE_PROJECT_OUT" | grep -qiE "already exists"; then
        info "Pages 프로젝트가 이미 존재함: $PAGES_PROJECT"
    else
        error "Pages 프로젝트 생성 실패: $CREATE_PROJECT_OUT"
    fi
fi

# BACKEND_URL 환경변수 설정
echo "🔧 BACKEND_URL 환경변수 설정: https://$API_DOMAIN"
wrangler pages secret put BACKEND_URL --project-name "$PAGES_PROJECT" <<< "https://$API_DOMAIN" && info "BACKEND_URL 설정 완료" || warn "환경변수 설정 실패 — 대시보드에서 수동 설정: https://$API_DOMAIN"

# 프론트엔드 배포
echo "📦 프론트엔드 배포 중..."
wrangler pages deploy . --project-name "$PAGES_PROJECT" --branch main
info "프론트엔드 배포 완료"

cd "$PROJECT_DIR"

# ─── 검증 ───
step "7/7 — 프로덕션 검증"

echo "⏳ DNS 전파 대기 중 (15초)..."
sleep 15

echo ""
echo "헬스체크: https://$API_DOMAIN/api/health"
if curl -sf --connect-timeout 5 --max-time 10 "https://$API_DOMAIN/api/health" 2>/dev/null; then
    info "API 헬스체크 OK!"
else
    warn "API가 아직 응답하지 않습니다. DNS 전파에 시간이 걸릴 수 있습니다."
    echo "   나중에 재시도: curl https://$API_DOMAIN/api/health"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 프로덕션 배포 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "프론트엔드: https://$PAGES_PROJECT.pages.dev"
echo "API:        https://$API_DOMAIN/api/health"
echo ""
echo "커스텀 도메인 설정 (Cloudflare 대시보드):"
echo "  Pages → $PAGES_PROJECT → Custom domains → 원하는 도메인 추가"
echo ""
echo "스테이징 URL 폐기:"
echo "  Quick Tunnel은 이미 중지됨. trycloudflare.com URL은 자동 만료됨."
