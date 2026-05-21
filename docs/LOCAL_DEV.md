# Local development on macOS (pre-Pi or anytime)

A 15-minute setup to run the app on your MacBook with Postgres in Docker, optionally exposed to your iPhone over Tailscale.

Companion to [`PI_SETUP.md`](./PI_SETUP.md) — the same `.env` shape, the same OAuth client. The Mac uses `localhost`, the Pi uses `vlam-pi.tailf0621c.ts.net`.

---

## 1. Pre-flight (one-time admin tasks)

Do these in any order — they don't touch the Mac:

- **Tailscale → HTTPS Certificates:** <https://login.tailscale.com/admin/dns> → enable. Required for `*.ts.net` TLS certs.
- **Tailscale → MagicDNS:** same page, on by default. Confirm.
- **Google OAuth → Test users:** <https://console.cloud.google.com/> → APIs & Services → OAuth consent screen → Test users → add both your email and your wife's. Without this, sign-in errors with `403: access_denied` even if `ALLOWED_EMAILS` is correct.
- **Tailscale invite for your wife** (if multi-user testing): admin console → Users → Invite.

## 2. Install prerequisites

```bash
brew install --cask tailscale       # sign in to your existing tailnet
brew install node@22 pnpm           # Node 22+ (for --env-file-if-exists)
brew install --cask docker          # Docker Desktop, for Postgres only
```

Verify: `node --version` ≥ `v22.7`.

## 3. OAuth: add localhost + Mac tailnet URIs

In <https://console.cloud.google.com/> → Credentials → click your OAuth client → **Authorised redirect URIs**, add:

1. `http://localhost:3000/api/auth/callback/google`
2. `https://victors-macbook-pro.tailf0621c.ts.net/api/auth/callback/google`

Find the Mac's tailnet hostname with `tailscale status` (e.g. `vinhs-macbook-pro`) or at <https://login.tailscale.com/admin/machines>.

The existing Pi redirect URI (`vlam-pi.tailf0621c.ts.net/...`) keeps working — Google allows multiple.

## 4. Clone, install, configure

```bash
mkdir -p ~/dev && cd ~/dev
git clone https://github.com/lamv-23/Personal-Budget.git
cd Personal-Budget
pnpm install
```

Generate two secrets:

```bash
openssl rand -base64 32             # AUTH_SECRET
openssl rand -base64 24             # POSTGRES_PASSWORD
```

Create `.env.local` (full app config — never committed):

```ini
DATABASE_URL=postgres://budget:<POSTGRES_PASSWORD>@localhost:5432/budget
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>

AUTH_SECRET=<AUTH_SECRET>
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=<Client ID>
AUTH_GOOGLE_SECRET=<Client Secret>

ALLOWED_EMAILS=lamv23@gmail.com,<wife's gmail>

EXTRACTION_PROVIDER=gemini
GEMINI_API_KEY=<Gemini key>
GEMINI_MODEL=gemini-2.5-flash

UPLOAD_DIR=./uploads
```

Create a minimal `.env` (Docker Compose reads this for variable substitution — only the Postgres password matters):

```ini
POSTGRES_PASSWORD=<same POSTGRES_PASSWORD as above>
```

### Port 5432 already in use?

```bash
lsof -i :5432                       # see what's listening
brew services stop postgresql        # if it's brew's postgres
```

Or remap by changing `docker-compose.yml` to `"127.0.0.1:5433:5432"` and updating `DATABASE_URL` to port 5433.

## 5. Run

```bash
docker compose up -d db             # Postgres only
pnpm db:migrate                     # creates schema (uses --env-file-if-exists=.env.local)
pnpm dev                            # http://localhost:3000
```

Sign in with an allowlisted Google account → land on Overview. Seed data (categories, accounts) is created on first sign-in.

## 6. iPhone testing — Tailscale Serve from the Mac

```bash
tailscale serve --bg https+insecure://localhost:3000
tailscale serve status              # shows the URL
```

(macOS Tailscale usually doesn't need `sudo`; prepend it if you get a permission error.)

This exposes the dev server at `https://victors-macbook-pro.tailf0621c.ts.net` to any device on your tailnet — including your iPhone. First-time cert issuance takes ~30–60 seconds.

Update `.env.local`:

```ini
AUTH_URL=https://victors-macbook-pro.tailf0621c.ts.net
```

Restart `pnpm dev` (Ctrl-C and re-run — Next reads env once at boot). Open the URL on your iPhone with Tailscale on. Same OAuth, real HTTPS.

When you're done with iPhone testing:

```bash
tailscale serve reset               # stop the mapping
```

…and revert `AUTH_URL=http://localhost:3000`.

## 7. Optional: dry-run the production Docker build

On Apple Silicon, this builds natively as `linux/arm64` — exactly what the Pi 5 runs. Catches Pi-specific bugs before the hardware arrives.

```bash
tailscale serve reset
cp .env.local .env
sed -i '' 's|@localhost:5432|@db:5432|' .env    # Docker uses the service name
docker compose up -d --build                    # full stack: app + db
```

App is at `http://localhost:3000`, same as `pnpm dev` but running the production multi-stage build.

## Verification checklist

Same as PI_SETUP.md — see the [pre-Pi testing plan](https://github.com/lamv-23/Personal-Budget) for the 13-step rundown (auth allowlist, seeding, transactions, budgets, extraction, worker, trends, CSV export, dark mode, mobile, multi-user, production build).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `pnpm db:migrate` says `DATABASE_URL undefined` | Node < 22.7 — upgrade (`brew upgrade node@22`). |
| `docker compose up` says port 5432 already in use | Stop the conflicting Postgres or remap to 5433 (see §4). |
| Sign-in returns `redirect_uri_mismatch` | Redirect URI in Google Cloud Console doesn't exactly match `AUTH_URL` + `/api/auth/callback/google`. Case-sensitive, no trailing slash. |
| Sign-in returns `403: access_denied` | Email isn't a Test User in Google Cloud Console → OAuth consent screen. |
| Sign-in returns "Access denied" inside the app | Email isn't in `ALLOWED_EMAILS`. Edit `.env.local`, restart `pnpm dev`. |
| `tailscale serve` says "no cert" | HTTPS Certificates not enabled in Tailscale admin (see §1). |
| Browser shows "your connection is not private" | First-time cert is still being issued — wait 30–60s, retry. |
| Document upload stays in `processing` forever | Worker didn't start. Check `pnpm dev` output for `[worker] pg-boss started`. If missing, `instrumentation.ts` may not be picked up — verify it's at the project root, not under `src/`. |
| Wife can't reach the Mac's `*.ts.net` URL from her phone | She isn't on the tailnet — invite her in Tailscale admin. |

## Moving data to the Pi later

If you build up test data on the Mac and want to bring it over:

```bash
# On Mac
docker compose exec db pg_dump -U budget -d budget --no-owner > budget-mac.sql

# Copy to Pi (after `docker compose up -d db` on the Pi)
scp budget-mac.sql vlam-pi.local:/tmp/
ssh vlam-pi.local 'cat /tmp/budget-mac.sql | sudo docker compose -f /opt/budget/docker-compose.yml exec -T db psql -U budget -d budget'
```
