# Cloudflare Pages 배포 가이드

## 프론트엔드 배포 (Cloudflare Pages)

### 1. Cloudflare Pages 설정
```bash
# wrangler CLI 설치
npm install -g wrangler

# 로그인
wrangler login

# 프로젝트 생성
cd frontend
wrangler pages project create taronyang --production-branch main
```

### 2. 배포
```bash
# 직접 배포
wrangler pages deploy . --project-name taronyang

# 또는 GitHub 연동 (Cloudflare 대시보드에서)
# - Repository: zemyalpha/taronyang
# - Build directory: frontend
# - Build command: (없음 - 정적 파일)
```

### 3. API 프록시 설정
Cloudflare Pages에서 백엔드 API로 프록시하려면 `functions/` 디렉토리 사용:

```javascript
// functions/api/[[path]].js
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const apiUrl = `http://192.168.0.87:8000/api/${url.pathname.replace('/api/', '')}`;
  
  return fetch(apiUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });
}
```

### 4. 커스텀 도메인
Cloudflare 대시보드 → Pages → taronyang → Custom domains
- taronyang.com (또는 원하는 도메인)

## 백엔드 (Mac mini 로컬)

### systemd/launchd 서비스 등록
```bash
# macOS LaunchAgent plist 파일 생성
cat > ~/Library/LaunchAgents/com.taronyang.api.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taronyang.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/env</string>
        <string>python3</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/zemyblue-mac-mini-m1/taronyang/backend</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# 서비스 로드
launchctl load ~/Library/LaunchAgents/com.taronyang.api.plist
```

### 외부 접근 (Tailscale 또는 ngrok)
```bash
# Tailscale Funnel 사용
tailscale funnel 8000

# 또는 ngrok
ngrok http 8000
```
