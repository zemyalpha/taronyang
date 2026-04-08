#!/bin/bash
# 타로냥 SQLite 데이터베이스 백업 스크립트
# 사용법: ./backup-db.sh [DB_PATH] [BACKUP_DIR]
#
# launchd 또는 cron에서 일별 자동 실행:
#   0 3 * * * /path/to/backup-db.sh
set -euo pipefail

DB_PATH="${1:-./backend/taronyang.db}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${2:-$PROJECT_DIR/backups}"
DB_PATH="$(cd "$PROJECT_DIR" && realpath --relative-to="$PROJECT_DIR" "$DB_PATH" 2>/dev/null || echo "$DB_PATH")"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/taronyang_${TIMESTAMP}.db"
MAX_BACKUPS=30

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ DB 파일을 찾을 수 없음: $DB_PATH" >&2
  exit 1
fi

# SQLite 안전 백업 (WAL 체크포인트 수행)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>/dev/null || {
  cp "$DB_PATH" "$BACKUP_FILE"
  echo "⚠️ sqlite3 백업 명령 실패, 파일 복사로 대체"
}

gzip -f "$BACKUP_FILE"
echo "✅ 백업 완료: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"

# 오래된 백업 정리 (MAX_BACKUPS개만 유지)
cd "$BACKUP_DIR"
ls -t taronyang_*.db.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f
echo "📁 백업 파일 수: $(ls taronyang_*.db.gz 2>/dev/null | wc -l | tr -d ' ')"

# WAL 파일 정리 (50MB 초과 시)
WAL_FILE="${DB_PATH}-wal"
if [ -f "$WAL_FILE" ] && [ "$(stat -f%z "$WAL_FILE" 2>/dev/null || stat -c%s "$WAL_FILE" 2>/dev/null)" -gt 52428800 ]; then
  sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null
  echo "🧹 WAL 파일 정리 완료"
fi
