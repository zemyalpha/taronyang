# 스테이징 환경 (Staging)

> **⚠️ 임시 URL 안내:** 스테이징은 Cloudflare Quick Tunnel을 사용하므로
> 터널 재시작 시 URL이 변경됩니다. 영구 도메인은 [ZEMA-2558](/ZEMA/issues/ZEMA-2558)
> 프로덕션 배포 승인 후 적용됩니다.

## 현재 스테이징 URL

```
https://cat-proposition-paris-articles.trycloudflare.com
```

- **마지막 확인:** 2026-06-21
- **상태:** 정상 응답 (HTTP 200)

## 현재 URL 찾는 방법

터널이 재시작되면 URL이 바뀝니다. 새 URL을 찾는 방법:

### 방법 1: cloudflared 로그 확인 (권장)
```bash
grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/taronyang-tunnel.err | tail -1
```

### 방법 2: launchctl 상태 확인
```bash
launchctl print gui/$(id -u)/com.taronyang.tunnel 2>/dev/null | grep -A5 arguments
```

### 방법 3: 터널 프로세스에서 직접 확인
```bash
ps aux | grep 'cloudflared tunnel --url' | grep -v grep
```

## 아키텍처

```
인터넷 → Cloudflare Quick Tunnel(*.trycloudflare.com)
       → localhost:8000 (Express 백엔드, launchd 관리)
```

| 구성 요소 | launchd 라벨 | 비고 |
|-----------|-------------|------|
| 백엔드 서버 | `com.taronyang.backend` | Express + SQLite, 포트 8000 |
| 클라우드플레어 터널 | `com.taronyang.tunnel` | Quick Tunnel 모드 |
| DB 백업 | `com.taronyang.db-backup` | 매일 03:00 |
| 헬스 모니터 | `com.taronyang.monitor` | 5분 간격 |

## 헬스 모니터링 로그

```bash
# 최근 헬스 체크 결과 확인
tail -20 ~/Library/Logs/taronyang-monitor.log

# 장애 기록만 필터
grep '❌' ~/Library/Logs/taronyang-monitor.log
```

## 스테이징 URL 업데이트 절차

터널 재시작 후 URL이 변경되면:

```bash
# 1. 새 URL 확인
NEW_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/taronyang-tunnel.err | tail -1)
echo "$NEW_URL"

# 2. 헬스 모니터의 공개 URL 체크용 파일 업데이트
echo -n "$NEW_URL" > ~/.taronyang-staging-url

# 3. 이 STAGING.md 파일의 URL도 업데이트
```

## 서비스 관리 명령어

```bash
# 모든 서비스 상태
launchctl list | grep taronyang

# 터널 재시작 (URL 변경됨)
launchctl kickstart -k gui/$(id -u)/com.taronyang.tunnel

# 백엔드 재시작
launchctl kickstart -k gui/$(id -u)/com.taronyang.backend

# 헬스 모니터 즉시 실행
bash scripts/health-check.sh

# 수동 백업 실행
bash scripts/backup-db.sh
```

## 관련 이슈

- [ZEMA-2558](/ZEMA/issues/ZEMA-2558) — 프로덕션 배포 (영구 도메인 + 명명된 터널)
- [ZEMA-2562](/ZEMA/issues/ZEMA-2562) — 스테이징 운영 강화 (이 문서)
