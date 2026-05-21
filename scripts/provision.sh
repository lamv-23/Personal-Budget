#!/bin/bash
# Family Budget — Raspberry Pi 5 provisioning script
# Run this once on a fresh Raspberry Pi OS Lite (64-bit) install, as the default user with sudo.
#
# Prerequisites (do these on your laptop first via Raspberry Pi Imager):
#   - Flash Raspberry Pi OS Lite (64-bit) to your NVMe SSD or microSD
#   - In Imager > "Edit Settings": set hostname to "vlam-pi", configure username, password,
#     enable SSH (with password or key), set Wi-Fi / locale / timezone
#   - Boot the Pi, SSH in, run this script:
#       curl -fsSL https://raw.githubusercontent.com/lamv-23/Personal-Budget/main/scripts/provision.sh | bash

set -euo pipefail

YELLOW="\033[1;33m"
GREEN="\033[1;32m"
RED="\033[1;31m"
NC="\033[0m"

echo -e "${GREEN}=== Family Budget — Raspberry Pi 5 Provisioning ===${NC}"
echo ""

# --- 0. Sanity checks ----------------------------------------------------------

if [[ $EUID -eq 0 ]]; then
  echo -e "${RED}Don't run this as root. Run as your normal user; the script uses sudo where needed.${NC}"
  exit 1
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "aarch64" ]]; then
  echo -e "${RED}Expected 64-bit ARM (aarch64) but got '$ARCH'.${NC}"
  echo "Re-flash with Raspberry Pi OS Lite (64-bit)."
  exit 1
fi

if ! grep -qi "raspberry pi" /proc/device-tree/model 2>/dev/null; then
  echo -e "${YELLOW}Warning: this doesn't look like a Raspberry Pi. Continuing anyway...${NC}"
fi

# Warn if booting from SD card (Postgres write-amp will kill it)
ROOT_DEV="$(findmnt -n -o SOURCE / | sed 's/p[0-9]*$//')"
if [[ "$ROOT_DEV" == *mmcblk* ]]; then
  echo -e "${YELLOW}⚠  Warning: you are booting from an SD card.${NC}"
  echo "   Postgres + Home Assistant will write heavily and kill SD cards in 6–12 months."
  echo "   Strongly recommended: re-flash to an NVMe SSD (M.2 HAT) before continuing."
  echo ""
  read -rp "Continue anyway? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
fi

# --- 1. System update ----------------------------------------------------------

echo -e "${GREEN}>>> Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y curl ca-certificates ufw cron gnupg

# --- 2. Docker -----------------------------------------------------------------

if ! command -v docker &>/dev/null; then
  echo -e "${GREEN}>>> Installing Docker...${NC}"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo -e "${YELLOW}Note: log out and back in (or 'newgrp docker') to use docker without sudo.${NC}"
else
  echo -e "${GREEN}>>> Docker already installed (skipping)${NC}"
fi

# --- 3. Tailscale --------------------------------------------------------------

if ! command -v tailscale &>/dev/null; then
  echo -e "${GREEN}>>> Installing Tailscale...${NC}"
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if ! sudo tailscale status &>/dev/null; then
  echo -e "${GREEN}>>> Bringing Tailscale up...${NC}"
  echo "    Follow the URL printed below to authenticate this Pi to your tailnet."
  sudo tailscale up --ssh --hostname="${TAILSCALE_HOSTNAME:-vlam-pi}"
else
  echo -e "${GREEN}>>> Tailscale already running (skipping)${NC}"
fi

# --- 4. Firewall (UFW) ---------------------------------------------------------

echo -e "${GREEN}>>> Configuring firewall (UFW)...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0          # everything from the tailnet
sudo ufw allow 22/tcp comment "SSH (LAN — Tailscale SSH preferred)"
sudo ufw allow 41641/udp comment "Tailscale"
sudo ufw --force enable

# --- 5. App + backup directories ----------------------------------------------

APP_DIR="${APP_DIR:-/opt/budget}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/budget}"

sudo mkdir -p "$APP_DIR" "$BACKUP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"
sudo chmod 700 "$BACKUP_DIR"

# --- 6. Power management — don't sleep on idle --------------------------------

# Pi OS Lite usually doesn't sleep, but disable Wi-Fi power saving to be safe.
if command -v iw &>/dev/null; then
  sudo iw dev wlan0 set power_save off 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}=== Provisioning complete ===${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Clone the repo (if not already):"
echo "       git clone https://github.com/lamv-23/Personal-Budget.git $APP_DIR"
echo ""
echo "  2. Configure your .env file:"
echo "       cd $APP_DIR"
echo "       cp .env.example .env"
echo "       nano .env       # fill in: AUTH_SECRET, Google OAuth, ALLOWED_EMAILS, GEMINI_API_KEY"
echo ""
echo "  3. Start the stack:"
echo "       docker compose up -d"
echo ""
echo "  4. Find your tailnet hostname:"
echo "       tailscale status | head -1"
echo "     and expose the app over HTTPS:"
echo "       sudo tailscale serve --bg https+insecure://localhost:3000"
echo ""
echo "     Then visit https://vlam-pi.tailf0621c.ts.net from any device on your tailnet."
echo ""
echo "  5. Schedule nightly backups:"
echo "       crontab -e"
echo "     Add this line:"
echo "       0 2 * * * $APP_DIR/scripts/backup.sh >> /var/log/budget-backup.log 2>&1"
echo ""
