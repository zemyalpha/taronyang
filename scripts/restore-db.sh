#!/bin/bash
# 타로냥 데이터베이스 복원 스크립트
# 사용법: ./restore-db.sh <BACKUP_FILE> [DB_PATH]
set -euo pipefail

BACKUP_FILE="${1:?사용법: restore-db.sh <backup_file.gz> [db_path]}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${2:-$PROJECT_DIR/backend/taronyang.db}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 백업 파일을 찾을 수 없음: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  RESTORE_BACKUP="${DB_PATH}.pre-restore-$(date +%Y%m%d_%H%M%S)"
  cp "$DB_PATH" "$RESTORE_BACKUP"
  echo "📦 현재 DB 백업: $RESTORE_BACKUP"
fi

TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" > "$TMPFILE"
else
  cp "$BACKUP_FILE" "$TMPFILE"
fi

sqlite3 "$TMPFILE" "PRAGMA integrity_check;" | grep -q "ok" || {
  echo "❌ 백업 파일 무결성 검증 실패" >&2
  exit 1
}

cp "$TMPFILE" "$DB_PATH"
echo "✅ 복원 완료: $DB_PATH (원본: $BACKUP_FILE)"
