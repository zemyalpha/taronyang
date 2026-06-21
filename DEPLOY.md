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

`frontend/functions/api/[[path]].js` 파일이 이미 생성되어 있음.
프록시는 `BACKEND_URL` 환경변수를 참조하며, 설정되지 않으면 `http://192.168.0.9:8000`으로 폴백.

**중요: 공개 배포를 위해서는 Mac mini 백엔드가 인터넷에서 접근 가능해야 함.**
사설 IP(`192.168.0.9`)는 Cloudflare 에지에서 접근할 수 없으므로 아래 방법 중 하나 필요:

#### 방법 A: Cloudflare Tunnel (권장)
```bash
# cloudflared 설치
brew install cloudflared

# 터널 생성 및 실행
cloudflared tunnel create taronyang
cloudflared tunnel route dns taronyang api.taronyang.com
cloudflared tunnel run --url http://localhost:8000 taronyang
```

Cloudflare Pages 환경변수에 `BACKEND_URL=https://api.taronyang.com` 설정.

#### 방법 A-0: Cloudflare Quick Tunnel (스테이징/임시 공개 URL)
Cloudflare 계정이나 인증 없이 즉시 공개 HTTPS URL 생성:

```bash
# Quick Tunnel 시작 (계정 불필요, URL은 *.trycloudflare.com)
cloudflared tunnel --url http://localhost:8000
```

**주의사항:**
- URL은 무작위이며 재시작마다 변경됨 (`*.trycloudflare.com`)
- 영구 도메인이나 커스텀 도메인 불가 — 이름 있는 터널(방법 A) 필요
- 스테이징/프리뷰 용도. 프로덕션은 방법 A 사용

**launchd 자동 실행:** `com.taronyang.tunnel.plist` 파일이 프로젝트 루트에 있음.
아래 명령어로 등록하여 재부팅 시 자동 시작되도록 설정할 수 있습니다:

```bash
# plist 파일을 LaunchAgents에 복사
cp com.taronyang.tunnel.plist ~/Library/LaunchAgents/

# 서비스 등록 및 실행
launchctl load ~/Library/LaunchAgents/com.taronyang.tunnel.plist

# 상태 확인
launchctl list | grep taronyang
```

관리 명령어:
```bash
# 중지
launchctl unload ~/Library/LaunchAgents/com.taronyang.tunnel.plist

# 재시작
launchctl unload ~/Library/LaunchAgents/com.taronyang.tunnel.plist
launchctl load ~/Library/LaunchAgents/com.taronyang.tunnel.plist

# 로그 확인
tail -f /tmp/taronyang-tunnel.log
tail -f /tmp/taronyang-tunnel.err
```

#### 방법 B: Tailscale Funnel
```bash
# Tailscale 설치 후
tailscale funnel 8000
```

Cloudflare Pages 환경변수에 Funnel URL 설정.

#### 로컬 개발용
사설 네트워크에서만 사용 시 기본값 그대로 사용 가능.

### 4. 커스텀 도메인
Cloudflare 대시보드 → Pages → taronyang → Custom domains
- taronyang.com (또는 원하는 도메인)

## Railway 배포 (Express 백엔드 + 프론트엔드 통합)

### 1. Railway 프로젝트 생성
1. [Railway](https://railway.app) 접속 → GitHub 계정으로 로그인
2. **New Project** → **Deploy from GitHub repo** → `zemyalpha/taronyang` 선택
3. 루트 디렉토리로 배포

### 2. 환경변수 설정
Railway 대시보드 → Variables 탭에서 다음 변수 설정:

```
ZAI_API_KEY=<실제 API 키>
ZAI_API_URL=https://api.z.ai/api/coding/paas/v4/chat/completions
ZAI_MODEL=glm-5
JWT_SECRET=<강력한 랜덤 문자열>
DATABASE_PATH=./taronyang.db
NODE_ENV=production
PORT=8000
```

OAuth, 결제 관련 변수는 필요시 추가.

### 3. 빌드/배포 설정
`railway.json`과 `Procfile`이 이미 루트에 설정되어 있음:

- **Procfile**: `web: node backend/dist/index.js`
- **railway.json**: Nixpacks 빌더 사용, `cd backend && npm install && npm run build` 후 실행

### 4. 배포 확인
```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 배포 로그 확인
railway logs

# 서비스 URL 확인
railway domain
```

배포 완료 후:
- `https://<your-app>.up.railway.app/` → 랜딩페이지
- `https://<your-app>.up.railway.app/api/health` → 헬스체크

### 5. 커스텀 도메인 (선택)
Railway 대시보드 → Settings → Domains → 커스텀 도메인 추가

## Mac mini 백엔드 자동 실행 (launchd)

`com.taronyang.backend.plist` 파일이 프로젝트 루트에 있음.

### 설치
```bash
# plist 파일을 LaunchAgents에 복사
cp com.taronyang.backend.plist ~/Library/LaunchAgents/

# 서비스 등록 및 실행
launchctl load ~/Library/LaunchAgents/com.taronyang.backend.plist

# 상태 확인
launchctl list | grep taronyang
```

### 관리 명령어
```bash
# 중지
launchctl unload ~/Library/LaunchAgents/com.taronyang.backend.plist

# 재시작
launchctl unload ~/Library/LaunchAgents/com.taronyang.backend.plist
launchctl load ~/Library/LaunchAgents/com.taronyang.backend.plist

# 로그 확인
tail -f /tmp/taronyang-backend.log
tail -f /tmp/taronyang-backend.err
```

### 설정 변경 시
plist의 `WorkingDirectory`나 Node.js 경로(`/opt/homebrew/bin/node`)가 변경되면:
1. `launchctl unload`로 기존 서비스 중지
2. plist 파일 수정
3. `launchctl load`로 재등록

### 전체 launchd 서비스 목록

| Label | plist | 용도 | 재시작 |
|-------|-------|------|--------|
| `com.taronyang.backend` | `com.taronyang.backend.plist` | Express 백엔드 (`node dist/index.js`) | KeepAlive |
| `com.taronyang.tunnel` | `com.taronyang.tunnel.plist` | Cloudflare Tunnel (로컬 8000 → 공개 HTTPS) | KeepAlive |
| `com.taronyang.db-backup` | `com.taronyang.db-backup.plist` | SQLite 일일 백업 (매일 03:00) | StartCalendarInterval |
| `com.taronyang.monitor` | `com.taronyang.monitor.plist` | 헬스체크 (5분 간격) | StartInterval 300 |

**주의:** launchd plist들은 절대 경로(`WorkingDirectory`)로 런타임 워크스페이스를 참조합니다.
feature 작업은 별도의 worktree에서 하고, 런타임 워크스페이스는 항상 `main`에 고정해야 합니다.

## main 병합 후 런타임 워크스페이스 동기화 (필수)

**이 단계는 모든 main 병합/푸시 후 반드시 실행해야 합니다.**

### 왜 필요한가

launchd 서비스들은 고정된 절대 경로의 런타임 워크스페이스를 참조합니다.
`git merge`로 main에 코드를 합쳐도, 그 경로의 워크스페이스는 여전히 feature 브랜치에
남아 있을 수 있습니다. 서비스는 디스크에 있는 코드를 읽으므로, 병합된 코드가
런타임 워크스페이스에 반영되지 않으면 서비스가 실패합니다.

이 문제는 두 번 발생했습니다:
- health-check.sh이 main에 있었지만 런타임 워크스페이스가 feature 브랜치에 있어
  monitor 서비스가 매 5분마다 실패 (exit 127)
- 병합 후 서비스가 구버전 코드를 실행

### 동기화 스크립트 실행

```bash
# 기본 — 런타임 경로를 plist에서 자동 감지
./scripts/sync-workspace.sh

# 미리 확인 (dry-run, 실제 변경 없음)
./scripts/sync-workspace.sh --dry-run

# 커밋되지 않은 변경사항이 있는 경우 강제 동기화 (stash 후 진행)
./scripts/sync-workspace.sh --force

# 경로를 명시적으로 지정
./scripts/sync-workspace.sh /path/to/runtime-workspace
```

스크립트가 수행하는 작업:
1. **작업 디렉토리 확인** — 커밋되지 않은 변경사항 감지 (안전하게 중단 또는 stash)
2. **main 동기화** — `git checkout main && git pull origin main`
3. **백엔드 빌드** — 코드 변경 시 `npm install` + `npm run build`
4. **서비스 재시작** — 백엔드 launchd 서비스 재시작 (`launchctl kickstart -k`)
5. **헬스체크** — `scripts/health-check.sh`로 서비스 정상 확인

### 동기화 후 확인

```bash
# 런타임 워크스페이스가 main인지 확인
git -C <runtime> branch --show-current   # → main 이어야 함

# launchd 서비스 상태 확인 (exit 0이어야 함)
launchctl list | grep taronyang
```

### 런타임 워크스페이스 규칙

- **런타임 워크스페이스는 항상 `main`에 고정**
- feature/fix 작업은 **별도의 worktree 또는 클론**에서 수행
- main에 병합 후 반드시 `scripts/sync-workspace.sh` 실행
- 절대 런타임 워크스페이스에서 직접 feature 브랜치를 체크아웃하지 말 것

## 로컬 실행

### 1. 환경설정
```bash
# backend/.env 파일이 이미 생성됨
# ZAI_API_KEY에 실제 키 입력 필요
```

### 2. 서버 실행
```bash
# 방법 1: 빌드 후 실행
cd backend && npm run build && npm start

# 방법 2: 개발 모드 (hot reload)
cd backend && npm run dev
```

### 3. 접속 확인
- 랜딩: http://localhost:8000/
- 타로: http://localhost:8000/tarot
- 운세: http://localhost:8000/daily
- 기록: http://localhost:8000/history
- 마이페이지: http://localhost:8000/mypage
- 로그인: http://localhost:8000/login
- 요금제: http://localhost:8000/pricing
- 헬스체크: http://localhost:8000/api/health
