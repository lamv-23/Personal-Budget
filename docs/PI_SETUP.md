# Raspberry Pi 5 Setup Guide

End-to-end instructions to run the Family Budget app on a Pi 5 at home, accessible to you and your wife via Tailscale.

Estimated time: **~90 minutes** including hardware unboxing. ~30 minutes if your Pi is already running Raspberry Pi OS.

---

## 1. Shopping list

| Item | ~AU$ | Notes |
|---|---|---|
| Raspberry Pi 5 (16 GB) | 220 | 8 GB also fine; 16 GB future-proofs for Home Assistant, Plex, etc. |
| Official 27 W USB-C PSU | 25 | **Don't skip.** Cheap chargers cause random reboots and SD-card corruption. |
| Official Active Cooler | 20 | Pi 5 throttles hard without active cooling. |
| Pi 5 case (with fan cutout) | 20 | Argon Neo 5, Pimoroni NVMe Base, or similar. |
| **NVMe SSD setup** (one of these): | | **Do NOT run Postgres on an SD card** — it'll die in 6–12 months. |
| · M.2 HAT + 256 GB NVMe SSD | 70 | Best. Pi 5 boots directly from NVMe. |
| · USB 3 enclosure + 256 GB SATA SSD | 50 | Also fine, slightly slower. |
| **Total** | **~AU$355** | |

Buy from **Core Electronics**, **Little Bird**, **Pi Australia**, or **Element14 AU**. Avoid eBay third-parties (counterfeit risk).

---

## 2. Flash Raspberry Pi OS

You'll do this once, on your laptop.

1. Install **Raspberry Pi Imager** from <https://www.raspberrypi.com/software/>.
2. Connect your NVMe SSD (via the M.2 HAT on the Pi itself, or temporarily via a USB-to-NVMe adapter on your laptop) — or, if going the USB-SSD route, plug the SSD into your laptop.
3. In Imager:
   - **Device:** Raspberry Pi 5
   - **OS:** Raspberry Pi OS Lite (64-bit) — under "Raspberry Pi OS (other)"
   - **Storage:** your SSD
4. Click the gear icon (or "Edit Settings") and configure:
   - **Hostname:** `budget-pi` (or anything memorable)
   - **Username + password:** pick your own (don't use defaults)
   - **Wireless LAN:** your home Wi-Fi (or skip if using Ethernet)
   - **Locale:** Australia / `Australia/Sydney`
   - **SSH:** enable with password (or paste your SSH public key — better)
5. Flash. Takes ~5 minutes.

Once done, insert the SSD into the Pi, connect the active cooler, plug in Ethernet (recommended for initial setup), and power on.

---

## 3. First SSH in

The Pi will boot, connect to your network, and appear on it as `budget-pi.local` (or whatever hostname you chose).

From your laptop terminal:

```bash
ssh <username>@budget-pi.local
```

If `.local` doesn't resolve (some Windows machines), find the Pi's IP from your router admin page and use that instead.

---

## 4. Run the provisioning script

This installs Docker, Tailscale, configures the firewall, and prepares directories.

```bash
curl -fsSL https://raw.githubusercontent.com/lamv-23/Personal-Budget/main/scripts/provision.sh -o /tmp/provision.sh
bash /tmp/provision.sh
```

It will:

- Update Raspberry Pi OS
- Install Docker + Docker Compose
- Install Tailscale and prompt you to authenticate (open the URL it prints in your laptop browser)
- Configure UFW so the Pi is firewalled — only Tailscale and SSH allowed inbound
- Create `/opt/budget` (where the app will live) and `/var/backups/budget`

After it finishes, log out and back in so your user picks up the new `docker` group membership:

```bash
exit
ssh <username>@budget-pi.local
```

---

## 5. Configure environment variables

You need 5 things from external services. Get them in any order:

### 5a. Google OAuth credentials (so you and your wife can sign in)

1. Go to <https://console.cloud.google.com/>
2. Create a new project: "Family Budget"
3. **APIs & Services → OAuth consent screen** → "External" → fill in app name (`Family Budget`), your email, and a homepage URL (use any placeholder — `https://example.com` is fine, this isn't checked for personal apps in Testing mode).
4. Add yourself and your wife to "Test users".
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**
   - Authorised redirect URI: `https://budget-pi.<your-tailnet>.ts.net/api/auth/callback/google`
     - You'll know `<your-tailnet>` after step 4 above — run `tailscale status` on the Pi to see it (it looks like `tail-abcde.ts.net`).
6. Copy the Client ID and Client Secret somewhere safe.

### 5b. Gemini API key (for AI document extraction)

1. Go to <https://aistudio.google.com/>
2. Sign in with your Google account.
3. Click "**Get API key**" → "**Create API key**". No credit card required; free tier is plenty for personal use.
4. Copy the key.

### 5c. Generate secrets on the Pi

```bash
# Auth.js session secret
openssl rand -base64 32
# Strong DB password
openssl rand -base64 24
```

Save both somewhere.

### 5d. Fill in `.env`

```bash
cd /opt/budget
git clone https://github.com/lamv-23/Personal-Budget.git .  # if not already cloned
cp .env.example .env
nano .env
```

Paste in:

```ini
POSTGRES_PASSWORD=<the strong password you just generated>
DATABASE_URL=postgres://budget:<same password>@db:5432/budget

AUTH_SECRET=<the auth.js secret you generated>
AUTH_URL=https://budget-pi.<your-tailnet>.ts.net
AUTH_GOOGLE_ID=<from step 5a>
AUTH_GOOGLE_SECRET=<from step 5a>

ALLOWED_EMAILS=lamv23@gmail.com,<wife's gmail>

EXTRACTION_PROVIDER=gemini
GEMINI_API_KEY=<from step 5b>
GEMINI_MODEL=gemini-2.5-flash

UPLOAD_DIR=/data/uploads
```

Save (Ctrl-O, Enter, Ctrl-X).

---

## 6. Start the stack

```bash
cd /opt/budget
docker compose up -d --build
```

The first build takes ~5–10 minutes on a Pi 5. Subsequent restarts are seconds.

Verify everything's running:

```bash
docker compose ps        # both services "running (healthy)"
docker compose logs -f app   # tail logs; Ctrl-C to exit
```

The app will run database migrations automatically on first start.

---

## 7. Expose over Tailscale Serve (HTTPS)

```bash
sudo tailscale serve --bg https+insecure://localhost:3000
```

Tailscale automatically issues a TLS certificate for your tailnet hostname. To check it:

```bash
sudo tailscale serve status
```

The app is now available at **`https://budget-pi.<your-tailnet>.ts.net`** to any device on your tailnet.

### Add your wife's phone to the tailnet

1. Install the Tailscale app on her phone (iOS App Store / Google Play).
2. Sign in with her own account, then in your Tailscale admin (<https://login.tailscale.com/admin>), invite her or share devices.

Both of you should now be able to open `https://budget-pi.<your-tailnet>.ts.net` from anywhere — at home, at work, on the train — as long as the Tailscale app is on.

---

## 8. Sign in and verify

1. From your phone or laptop (on the tailnet): visit `https://budget-pi.<your-tailnet>.ts.net`.
2. Click "**Continue with Google**" → sign in with a whitelisted account.
3. You should land on the Overview page.
4. Quick smoke test:
   - **Add transaction** → adds an income or expense → it appears on Overview.
   - **Budgets** → set a Groceries budget.
   - **Documents** → drop a sample PDF → wait ~10s → check **Inbox** for AI-extracted transactions.
   - **Settings** → check your wife is listed as a household member after she signs in.

---

## 9. Schedule nightly backups

```bash
crontab -e
```

Add (and save):

```cron
0 2 * * * /opt/budget/scripts/backup.sh >> /var/log/budget-backup.log 2>&1
```

Every night at 2 AM, this runs `pg_dump` and a tarball of uploads to `/var/backups/budget/`, keeping 30 days.

### Off-Pi backup (highly recommended)

A backup on the same Pi protects against software corruption, **not** against the Pi failing or being stolen. Pick one of:

- `rclone sync /var/backups/budget remote:budget-backups` to Backblaze B2 (~10 GB free, fine for years of dumps)
- `rsync /var/backups/budget user@other-machine:` to a NAS or a friend's machine
- Plug a USB stick in once a week and copy across

This is in the deferred enhancements backlog — add it when you're comfortable with the system.

---

## 10. Running alongside Home Assistant / other projects

The Pi 5 16 GB can run all of these at once with headroom:

```
/opt/budget        ← this app          (Docker Compose, ports 127.0.0.1:3000 + DB internal)
/opt/homeassistant ← Home Assistant    (Docker Compose, port 127.0.0.1:8123)
/opt/grafana       ← Grafana + InfluxDB (port 127.0.0.1:3001)
```

Each gets its own Tailscale Serve hostname:

```bash
sudo tailscale serve --bg --https=443 https+insecure://localhost:3000   # budget
sudo tailscale serve --bg --https=8443 https+insecure://localhost:8123  # home assistant
```

(Or use `tailscale funnel` if you want a few of them public-internet reachable. Probably not needed.)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose up` fails with "permission denied" | You haven't re-logged in since provisioning — `exit` and SSH back in, or run `newgrp docker`. |
| Pi randomly reboots | Cheap PSU or no active cooler. Replace with the official 27 W PSU and add active cooling. |
| App is slow | Check storage with `iostat -xz 1`. If on SD card, move to NVMe. |
| `tailscale serve` says "no cert" | Your tailnet needs HTTPS enabled in the admin console: <https://login.tailscale.com/admin/dns> → "HTTPS Certificates" → enable. |
| Sign-in says "Access denied" | Check `ALLOWED_EMAILS` in `.env` matches the Google account you're signing in with (case-insensitive). Restart with `docker compose restart app`. |
| Browser shows "your connection is not private" | `tailscale serve` cert is still issuing (takes ~1 min) — wait, then retry. |
| `docker compose logs app` shows DB connection error | Run `docker compose down && docker compose up -d` — the migration sometimes races on first boot. |

---

## Updating to a new version

```bash
cd /opt/budget
git pull
docker compose up -d --build
```

Migrations run automatically on container start.
