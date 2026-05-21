# Family Budget

A self-hosted budget dashboard for two-person households. Upload bills, payslips, and dividend statements; an AI agent (Google Gemini 2.5 Flash) extracts the transactions; the dashboard tracks income, expenses, savings, and monthly category budgets — all in AUD, Sydney time.

Designed to run on a **Raspberry Pi 5 at home** behind Tailscale. The Docker Compose stack also runs unchanged on any Linux box (NAS, VM, spare laptop).

---

## Features

- **Overview dashboard** — monthly KPI cards (Income / Expenses / Savings / Net), 12-month chart, top budget progress, recent transactions
- **Transactions** — full CRUD, category colour-coding, AUD formatting, Sydney timezone
- **Budgets** — monthly budgets per category, progress bars with overspend warnings
- **AI document extraction** — drop a PDF or photo of a bill, payslip, or dividend statement; Gemini 2.5 Flash extracts structured transactions; you confirm/edit them in the Inbox before they hit the dashboard
- **Trends** — 12-month income vs expense, category breakdowns
- **Settings** — categories (CRUD with colours), accounts, household members
- **Google sign-in** with email allowlist (you + your wife only)
- **Private by default** — runs on your hardware, accessed via Tailscale (no public URL)

---

## Stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind v4, shadcn-style UI |
| Backend | Next.js server actions + route handlers |
| Database | Postgres 16 (Docker), Drizzle ORM |
| Auth | Auth.js v5 with Google OAuth + email allowlist |
| AI | Google Gemini 2.5 Flash (vision + function calling); provider interface allows swap to Claude Haiku 4.5 |
| Background jobs | `pg-boss` (Postgres-backed queue, no Redis needed) |
| Deployment | Docker Compose + Tailscale Serve (HTTPS via `*.ts.net`) |

---

## Deploy on a Raspberry Pi 5

The full hardware shopping list and step-by-step setup is in **[docs/PI_SETUP.md](docs/PI_SETUP.md)**.

TL;DR once your Pi has Raspberry Pi OS Lite (64-bit):

```bash
# On the Pi (SSH in)
curl -fsSL https://raw.githubusercontent.com/lamv-23/Personal-Budget/main/scripts/provision.sh | bash

git clone https://github.com/lamv-23/Personal-Budget.git /opt/budget
cd /opt/budget
cp .env.example .env
nano .env   # fill in: AUTH_SECRET, Google OAuth, ALLOWED_EMAILS, GEMINI_API_KEY

docker compose up -d --build
sudo tailscale serve --bg https+insecure://localhost:3000
```

The app is then reachable at `https://<pi-hostname>.<your-tailnet>.ts.net` from any device on your tailnet.

---

## Deploy elsewhere

The same `docker-compose.yml` runs on:

- **Any Linux machine** (spare laptop, desktop, mini-PC, NAS with Docker)
- **A small cloud VM** (Hetzner CX22, DigitalOcean Sydney, BinaryLane, etc.)

The provisioning script in `scripts/provision.sh` targets Raspberry Pi OS but will work on any modern Debian/Ubuntu with minor edits.

---

## Local development

```bash
pnpm install
cp .env.example .env.local       # point DATABASE_URL at a local Postgres
docker compose up -d db          # or use any local Postgres
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000.

---

## Project layout

```
app/                   # Next.js App Router pages and API routes
  (app)/               # authenticated app shell (Overview, Transactions, Inbox, Budgets, Trends, Settings)
  signin/              # public sign-in page
  api/                 # transaction CRUD, upload, auth
agent/                 # AI extraction pipeline
  extract.ts           # pg-boss job handler — loads doc, calls provider, inserts pending tx
  prompts.ts           # system instruction + extraction schema
  providers/gemini.ts  # Gemini 2.5 Flash implementation
  worker.ts            # pg-boss boot
components/            # UI components + charts
db/                    # Drizzle schema, client, queries, seed
lib/                   # auth, money (AUD), dates (Sydney TZ), utils
drizzle/               # migrations
scripts/               # provision.sh (Pi), backup.sh (nightly pg_dump)
docs/                  # PI_SETUP.md
```

---

## Backup & recovery

`scripts/backup.sh` runs nightly via cron (configured during provisioning) and writes gzipped `pg_dump` + uploads tarballs to `/var/backups/budget`, keeping 30 days.

For off-Pi backups (recommended), see the "Off-Pi backup" section in [PI_SETUP.md](docs/PI_SETUP.md#9-schedule-nightly-backups).

To restore:

```bash
gunzip < /var/backups/budget/db-YYYY-MM-DD.sql.gz | \
  docker compose exec -T db psql -U budget budget
```

---

## License

Personal use.
