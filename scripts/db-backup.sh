#!/usr/bin/env bash
# ============================================================
# Database Backup Script for Supabase/PostgreSQL
# Run daily via cron or scheduled task.
# Usage:   bash scripts/db-backup.sh
#
# Prerequisites:
#   pg_dump must be installed (PostgreSQL client tools)
#   DATABASE_URL must be set in backend/.env
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV="$SCRIPT_DIR/../backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
    echo "[ERROR] backend/.env not found. Cannot read DATABASE_URL."
    exit 1
fi

# Load DATABASE_URL from backend .env
DATABASE_URL=$(grep -E "^DATABASE_URL=" "$BACKEND_ENV" | head -1 | cut -d= -f2- | tr -d '"')
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL not found in backend/.env"
    exit 1
fi

# Convert postgresql:// to postgres:// for pg_dump compatibility
BACKUP_URL="${DATABASE_URL/postgresql:/postgres:}"

BACKUP_DIR="$SCRIPT_DIR/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/studymate_db_$TIMESTAMP.sql"
BACKUP_GZ="$BACKUP_FILE.gz"

echo "[Backup] Starting database backup..."
echo "[Backup] Output: $BACKUP_GZ"

pg_dump "$BACKUP_URL" \
    --no-owner \
    --no-acl \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_GZ" 2>&1

if [ $? -eq 0 ]; then
    echo "[Backup] Completed successfully: $BACKUP_GZ"
    echo "[Backup] Size: $(du -h "$BACKUP_GZ" | cut -f1)"
    
    # Keep only last 30 backups
    find "$BACKUP_DIR" -name "studymate_db_*.sql.gz" -mtime +30 -delete
    echo "[Backup] Cleaned up backups older than 30 days."
else
    echo "[ERROR] Backup failed."
    exit 1
fi
