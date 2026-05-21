#!/bin/bash
# Nightly backup: pg_dump + uploads tarball.
#
# By default writes to /var/backups/budget on the Pi itself. For real safety,
# also rsync this directory to a second location (another Pi, NAS, cloud bucket).
#
# Cron: 0 2 * * * /opt/budget/scripts/backup.sh >> /var/log/budget-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/budget}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATE=$(date +%F)

mkdir -p "$BACKUP_DIR"

# 1. Database dump (gzipped)
echo "[$(date)] Dumping database..."
docker compose -f "$APP_DIR/docker-compose.yml" exec -T db \
  pg_dump -U budget budget | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"
echo "[$(date)] Database dump: $(du -h "$BACKUP_DIR/db-$DATE.sql.gz" | cut -f1)"

# 2. Uploads tarball (only if the volume has files)
UPLOADS_VOLUME=$(docker compose -f "$APP_DIR/docker-compose.yml" config --format json \
  | grep -o '"uploads"[^,]*' | head -1 || true)
if [[ -n "$UPLOADS_VOLUME" ]]; then
  echo "[$(date)] Backing up uploads volume..."
  docker run --rm \
    -v "$(basename "$APP_DIR")_uploads:/data:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine \
    tar czf "/backup/uploads-$DATE.tar.gz" -C /data . 2>/dev/null || \
    echo "[$(date)] (no uploads to back up yet)"
fi

# 3. Prune backups older than 30 days
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +30 -delete 2>/dev/null || true
echo "[$(date)] Pruned backups older than 30 days"

echo "[$(date)] Backup complete."
