#!/bin/bash
# Nightly backup: pg_dump + uploads tarball to /var/backups/budget
set -euo pipefail

BACKUP_DIR=/var/backups/budget
DATE=$(date +%F)
APP_DIR="$(dirname "$(dirname "$0")")"

mkdir -p "$BACKUP_DIR"

# 1. Database dump
echo "[$(date)] Dumping database..."
docker compose -f "$APP_DIR/docker-compose.yml" exec -T db \
  pg_dump -U budget budget | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"
echo "[$(date)] Database dump done: db-$DATE.sql.gz"

# 2. Prune backups older than 30 days
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +30 -delete
echo "[$(date)] Pruned old backups"
