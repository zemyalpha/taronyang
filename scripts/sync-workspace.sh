#!/bin/bash
# 타로냥 런타임 워크스페이스 동기화 스크립트 (post-merge sync)
#
# 문제 배경 (ZEMA-2565 / ZEMA-2553):
#   코드가 main에 머지되고 origin/main에 푸시되어도, launchd 서비스가
#   읽는 런타임 워크스페이스는 feature 브랜치에 남아 있어 서비스가
#   실패하는 패턴이 반복되었다. 이 스크립트는 main 병합 후 런타임
#   워크스페이스를 동기화하고 서비스를 재시작하여 이를 방지한다.
#
# 수행 작업:
#   1. 런타임 워크스페이스 경로 확인 (인자 / 환경변수 / plist 자동 추출)
#   2. 커밋되지 않은 변경사항 감지 (안전하게 stash 또는 명시적 중단)
#   3. git fetch origin main && git reset --hard origin/main (결정론적 동기화)
#   4. 백엔드 코드 변경 시 npm install + npm run build
#   5. launchd 서비스 재시작 (backend)
#   6. 헬스체크로 서비스 정상 확인
#
# 사용법:
#   ./scripts/sync-workspace.sh [RUNTIME_DIR]
#   ./scripts/sync-workspace.sh /path/to/runtime
#   TARONYANG_RUNTIME_DIR=/path/to/runtime ./scripts/sync-workspace.sh
#   ./scripts/sync-workspace.sh --force     # 변경사항을 stash 후 동기화
#   ./scripts/sync-workspace.sh --dry-run   # 실제 변경 없이 시뮬레이션
#   ./scripts/sync-workspace.sh --skip-restart  # 서비스 재시작 건너뜀
#
# 환경변수:
#   TARONYANG_RUNTIME_DIR  런타임 워크스페이스 경로 (첫 번째 인자보다 우선하지 않음)
#
# 종료 코드:
#   0 = 동기화 성공, 모든 서비스 정상
#   1 = 동기화 실패 또는 헬스체크 실패
#   2 = 커밋되지 않은 변경사항이 있어 중단 (--force 필요)
set -euo pipefail

# ─── 색상 / 상태 출력 ───
info()    { echo "📋 $1"; }
success() { echo "✅ $1"; }
warn()    { echo "⚠️  $1"; }
error()   { echo "❌ $1" >&2; }
die()     { error "$1"; exit "${2:-1}"; }

# ─── 인자 파싱 ───
FORCE=0
DRY_RUN=0
SKIP_RESTART=0
RUNTIME_DIR=""

for arg in "$@"; do
  case "$arg" in
    --force)        FORCE=1 ;;
    --dry-run)      DRY_RUN=1 ;;
    --skip-restart) SKIP_RESTART=1 ;;
    -h|--help)
      cat <<'HELP'
타로냥 런타임 워크스페이스 동기화 (post-merge sync)

사용법:
  ./scripts/sync-workspace.sh [RUNTIME_DIR]
  ./scripts/sync-workspace.sh /path/to/runtime
  TARONYANG_RUNTIME_DIR=/path/to/runtime ./scripts/sync-workspace.sh
  ./scripts/sync-workspace.sh --force        # 변경사항을 stash 후 동기화
  ./scripts/sync-workspace.sh --dry-run      # 실제 변경 없이 시뮬레이션
  ./scripts/sync-workspace.sh --skip-restart # 서비스 재시작 건너뜀

옵션:
  RUNTIME_DIR            런타임 워크스페이스 경로 (위치 인자)
  --force                커밋되지 않은 변경사항을 자동으로 stash
  --dry-run              실제 변경 없이 시뮬레이션
  --skip-restart         launchd 서비스 재시작 건너뜀
  -h, --help             이 도움말 출력

환경변수:
  TARONYANG_RUNTIME_DIR  런타임 워크스페이스 경로

종료 코드:
  0 = 성공   1 = 실패   2 = 변경사항 있음 (--force 필요)
HELP
      exit 0
      ;;
    -*)
      die "알 수 없는 옵션: $arg (--help 참조)" 1
      ;;
    *)
      [ -n "$RUNTIME_DIR" ] && die "런타임 경로는 하나만 지정 가능" 1
      RUNTIME_DIR="$arg"
      ;;
  esac
done

# ─── 1. 런타임 워크스페이스 경로 결정 ───
# 우선순위: 명시적 인자 > 환경변수 > plist에서 자동 추출
if [ -z "$RUNTIME_DIR" ]; then
  RUNTIME_DIR="${TARONYANG_RUNTIME_DIR:-}"
fi

if [ -z "$RUNTIME_DIR" ]; then
  # com.taronyang.backend.plist에서 WorkingDirectory 추출 시도
  BACKEND_PLIST="$HOME/Library/LaunchAgents/com.taronyang.backend.plist"
  if [ -f "$BACKEND_PLIST" ]; then
    # WorkingDirectory에서 backend를 제거하여 프로젝트 루트 추출
    BACKEND_WD=$(plutil -extract WorkingDirectory raw "$BACKEND_PLIST" 2>/dev/null || \
                 grep -A1 '<key>WorkingDirectory</key>' "$BACKEND_PLIST" | \
                 grep -oE '/[^<]+' | head -1)
    if [ -n "$BACKEND_WD" ]; then
      # .../taronyang/backend → .../taronyang
      RUNTIME_DIR="${BACKEND_WD%/backend}"
    fi
  fi
fi

if [ -z "$RUNTIME_DIR" ]; then
  die "런타임 워크스페이스 경로를 찾을 수 없습니다. 인자로 전달하거나 TARONYANG_RUNTIME_DIR 환경변수를 설정하세요." 1
fi

# 절대경로로 변환
RUNTIME_DIR="$(cd "$RUNTIME_DIR" 2>/dev/null && pwd)" || \
  die "런타임 워크스페이스 경로에 접근할 수 없음: $RUNTIME_DIR" 1

info "런타임 워크스페이스: $RUNTIME_DIR"

# git 저장소인지 확인
git -C "$RUNTIME_DIR" rev-parse --git-dir >/dev/null 2>&1 || \
  die "지정된 경로가 git 저장소가 아님: $RUNTIME_DIR" 1

# ─── dry-run 모드 ───
if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "=== 🧪 DRY RUN (실제 변경 없음) ==="
  CURRENT_BRANCH=$(git -C "$RUNTIME_DIR" branch --show-current)
  info "현재 브랜치: $CURRENT_BRANCH"
  git -C "$RUNTIME_DIR" fetch origin main 2>/dev/null || true
  LOCAL=$(git -C "$RUNTIME_DIR" rev-parse main 2>/dev/null || echo "unknown")
  REMOTE=$(git -C "$RUNTIME_DIR" rev-parse origin/main 2>/dev/null || echo "unknown")
  if [ "$LOCAL" = "$REMOTE" ]; then
    success "이미 main 최신 상태 (커밋: ${LOCAL:0:8})"
  else
    warn "main 업데이트 있음: 로컬 ${LOCAL:0:8} → 원격 ${REMOTE:0:8}"
    CHANGED_FILES=$(git -C "$RUNTIME_DIR" diff --name-only main origin/main 2>/dev/null | head -20)
    if [ -n "$CHANGED_FILES" ]; then
      info "변경될 파일:"
      echo "$CHANGED_FILES" | sed 's/^/    /'
    fi
  fi
  echo ""
  info "dry-run 완료 — 실제 동기화는 --dry-run 없이 실행하세요."
  exit 0
fi

# ─── 2. 커밋되지 않은 변경사항 확인 ───
echo ""
echo "=== 1/5. 작업 디렉토리 확인 ==="
# 추적되는 파일의 변경사항만 확인 (untracked는 무시)
DIRTY=$(git -C "$RUNTIME_DIR" status --porcelain --untracked-files=no)
if [ -n "$DIRTY" ]; then
  if [ "$FORCE" -eq 1 ]; then
    warn "커밋되지 않은 변경사항이 있습니다 — --force로 stash합니다:"
    echo "$DIRTY" | sed 's/^/    /'
    STASH_MSG="sync-workspace.sh auto-stash $(date '+%Y-%m-%d %H:%M:%S')"
    git -C "$RUNTIME_DIR" stash push -m "$STASH_MSG" -- >/dev/null 2>&1 || \
      die "stash 실패 — 수동으로 변경사항을 정리하세요" 1
    success "변경사항을 stash했습니다: $STASH_MSG"
    info "복구 명령: git -C \"$RUNTIME_DIR\" stash pop"
  else
    error "커밋되지 않은 변경사항이 있어 동기화를 중단합니다:"
    echo "$DIRTY" | sed 's/^/    /' >&2
    echo "" >&2
    die "커밋하거나 --force 플래그로 stash 후 동기화하세요." 2
  fi
else
  success "작업 디렉토리 깨끗함"
fi

# ─── 3. main 체크아웃 및 pull ───
echo ""
echo "=== 2/5. main 브랜치 동기화 ==="
CURRENT_BRANCH=$(git -C "$RUNTIME_DIR" branch --show-current)
OLD_HEAD=$(git -C "$RUNTIME_DIR" rev-parse HEAD 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" != "main" ]; then
  info "현재 브랜치: $CURRENT_BRANCH → main으로 전환"
  git -C "$RUNTIME_DIR" checkout main || die "main 체크아웃 실패" 1
else
  info "이미 main 브랜치"
fi

info "origin/main에서 fetch + reset (결정론적 동기화)..."
git -C "$RUNTIME_DIR" fetch origin main || die "git fetch 실패" 1
git -C "$RUNTIME_DIR" reset --hard origin/main || die "git reset --hard 실패" 1

NEW_HEAD=$(git -C "$RUNTIME_DIR" rev-parse HEAD 2>/dev/null || echo "")
CURRENT_BRANCH=$(git -C "$RUNTIME_DIR" branch --show-current)
success "브랜치: $CURRENT_BRANCH (커밋: ${NEW_HEAD:0:8})"

if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
  warn "변경사항 없음 — 이미 최신 상태"
fi

# ─── 4. 백엔드 빌드 (변경 시) ───
echo ""
echo "=== 3/5. 백엔드 빌드 ==="
BACKEND_DIR="$RUNTIME_DIR/backend"
NEEDS_INSTALL=0
NEEDS_BUILD=0

if [ -n "$OLD_HEAD" ] && [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
  # 백엔드 관련 파일이 변경되었는지 확인
  BACKEND_CHANGES=$(git -C "$RUNTIME_DIR" diff --name-only "$OLD_HEAD" "$NEW_HEAD" -- backend/ 2>/dev/null || echo "")
  if [ -n "$BACKEND_CHANGES" ]; then
    NEEDS_BUILD=1
    info "백엔드 파일 변경 감지:"
    echo "$BACKEND_CHANGES" | sed 's/^/    /'
    # package.json 또는 package-lock.json이 변경되면 의존성 재설치
    if echo "$BACKEND_CHANGES" | grep -qE 'backend/(package\.json|package-lock\.json)'; then
      NEEDS_INSTALL=1
    fi
  fi
else
  # 변경사항이 없거나 OLD_HEAD를 알 수 없는 경우 — dist가 없으면 빌드
  if [ ! -d "$BACKEND_DIR/dist" ]; then
    NEEDS_BUILD=1
    NEEDS_INSTALL=1
    warn "backend/dist 없음 — 초기 빌드 필요"
  fi
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  info "의존성 설치 (backend)..."
  # npm ci for reproducible builds; fall back to npm install if no lockfile
  if [ -f "$BACKEND_DIR/package-lock.json" ]; then
    (cd "$BACKEND_DIR" && npm ci) || die "npm ci 실패" 1
  else
    (cd "$BACKEND_DIR" && npm install) || die "npm install 실패" 1
  fi
  success "의존성 설치 완료"
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
  info "npm run build (backend)..."
  (cd "$BACKEND_DIR" && npm run build) || die "백엔드 빌드 실패" 1
  success "백엔드 빌드 완료"
else
  success "백엔드 빌드 불필요 (코드 변경 없음)"
fi

# ─── 5. launchd 서비스 재시작 ───
echo ""
echo "=== 4/5. launchd 서비스 재시작 ==="
GUI_DOMAIN="gui/$(id -u)"

restart_service() {
  local label="$1"
  local plist_path="$HOME/Library/LaunchAgents/${label}.plist"
  if launchctl list "$label" >/dev/null 2>&1; then
    if [ "$SKIP_RESTART" -eq 0 ]; then
      info "재시작: $label"
      launchctl kickstart -k "$GUI_DOMAIN/$label" 2>/dev/null || {
        # kickstart 실패 시 unload/load fallback
        launchctl unload "$plist_path" 2>/dev/null || true
        launchctl load "$plist_path" 2>/dev/null || true
      }
      success "$label 재시작됨"
    else
      warn "$label 재시작 건너뜀 (--skip-restart)"
    fi
  else
    warn "$label 미설치 (건너뜀)"
  fi
}

# 백엔드는 코드 변경 시 항상 재시작
if [ "$NEEDS_BUILD" -eq 1 ] || [ "$FORCE" -eq 1 ]; then
  restart_service "com.taronyang.backend"
else
  success "백엔드 재시작 불필요 (코드 변경 없음)"
fi

# 모니터는 bash 스크립트이므로 매 실행 시 최신 코드를 읽음 — 재시작 불필요
# 터널/백업도 리포지토리 코드에 의존하지 않음

# ─── 6. 헬스체크 ───
echo ""
echo "=== 5/5. 헬스체크 ==="
if [ "$SKIP_RESTART" -eq 1 ]; then
  warn "서비스 재시작을 건너뛰었으므로 헬스체크를 생략합니다."
  echo ""
  success "동기화 완료 (재시작 생략)"
  exit 0
fi

# 백엔드 재시작 후 헬스체크 — 재시도 루프로 기동 대기
HEALTH_SCRIPT="$RUNTIME_DIR/scripts/health-check.sh"
if [ -x "$HEALTH_SCRIPT" ]; then
  info "헬스체크 대기 중 (백엔드 기동, 최대 30초 재시도)..."
  HEALTH_OK=0
  for attempt in 1 2 3 4 5 6; do
    sleep 5
    if "$HEALTH_SCRIPT" >/dev/null 2>&1; then
      HEALTH_OK=1
      success "헬스체크 통과 (시도 ${attempt}/6, ${attempt}*5초 대기)"
      break
    fi
    warn "헬스체크 재시도 ${attempt}/6 — 백엔드 기동 대기 중..."
  done

  if [ "$HEALTH_OK" -eq 1 ]; then
    echo ""
    success "🎉 동기화 완료 — 모든 서비스 정상"
    echo ""
    info "런타임 브랜치: $(git -C "$RUNTIME_DIR" branch --show-current)"
    info "런타임 커밋: ${NEW_HEAD:0:8}"
    exit 0
  else
    error "헬스체크 실패 (6회 재시도 후에도 응답 없음) — 서비스 상태를 수동으로 확인하세요:"
    echo "    launchctl list | grep taronyang"
    echo "    tail -50 /tmp/taronyang-backend.err"
    echo "    tail -50 /tmp/taronyang-monitor.err"
    exit 1
  fi
else
  warn "health-check.sh 없음 — 수동으로 서비스 상태를 확인하세요"
  launchctl list | grep taronyang || true
  echo ""
  success "동기화 완료 (헬스체크 스크립트 없음 — 수동 확인 필요)"
  exit 0
fi
