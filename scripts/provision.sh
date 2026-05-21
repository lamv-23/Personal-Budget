#!/bin/bash
# Run this once on a fresh Hetzner Ubuntu 24.04 VM as root
set -euo pipefail

echo "=== Family Budget VM Provisioning ==="

# 1. Docker
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu 2>/dev/null || true
fi

# 2. Tailscale
if ! command -v tailscale &>/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

tailscale up --ssh --accept-routes
echo "Tailscale up. Run: tailscale ip -4"

# 3. Firewall — close all except Tailscale UDP
if command -v ufw &>/dev/null; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 41641/udp comment "Tailscale"
  ufw --force enable
  echo "UFW configured"
fi

# 4. Expose app via Tailscale Serve (HTTPS at tailnet hostname)
# Run after setting up app:
# tailscale serve --bg https+insecure://localhost:3000

# 5. Backup directory
mkdir -p /var/backups/budget
chmod 700 /var/backups/budget

echo ""
echo "=== Next steps ==="
echo "1. Copy your .env file to /opt/budget/.env"
echo "2. cd /opt/budget && docker compose up -d"
echo "3. tailscale serve --bg https+insecure://localhost:3000"
echo "4. Add cron for backups: crontab -e"
echo "   0 2 * * * /opt/budget/scripts/backup.sh >> /var/log/budget-backup.log 2>&1"
