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
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/taronyang-tunnel.err | tail -1
```

> Quick Tunnel의 퍼블릭 URL은 cloudflared가 stderr로 출력하며
> `launchctl print` / `ps aux`에는 로컬 주소(`http://localhost:8000`)만
> 표시되므로, URL 확인은 반드시 로그를 통해서만 가능합니다.

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
NEW_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/taronyang-tunnel.err | tail -1)
echo "$NEW_URL"

# 2. 이 STAGING.md 파일의 URL도 업데이트
```

## launchd 서비스 설정 가이드

`com.taronyang.monitor.plist` 파일에는 `/Users/YOUR_USERNAME/` 플레이스홀더가 포함되어 있습니다.
각 개발자/서버 환경에 맞게 경로를 치환한 후 launchd에 등록해야 합니다.

### 1. 경로 치환

```bash
# 현재 사용자의 홈 디렉토리로 치환
sed "s|/Users/YOUR_USERNAME|$HOME|g" com.taronyang.monitor.plist \
  > ~/Library/LaunchAgents/com.taronyang.monitor.plist
```

### 2. 로그 디렉토리 생성

```bash
mkdir -p ~/Library/Logs
```

### 3. launchd 서비스 등록

```bash
# 헬스 모니터 등록
launchctl load ~/Library/LaunchAgents/com.taronyang.monitor.plist

# 등록 확인 (PID가 숫자로 표시되면 정상)
launchctl list | grep taronyang
```

### 4. 동작 확인

```bash
# 즉시 실행하여 로그 확인
bash scripts/health-check.sh

# 로그 파일 확인
tail -20 ~/Library/Logs/taronyang-monitor.log
```

> **참고:** `launchd` plist는 절대 경로만 지원하므로 `$HOME` 변수를 직접 사용할 수 없습니다.
> 체크인된 plist는 `YOUR_USERNAME` 플레이스홀더를 사용하며, 설치 시 위 명령으로 치환합니다.

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
