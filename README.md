# Powerbuild — Training

Local-first powerbuilding app: programs, sessions, readiness, exercise history, and strength profiles (Next.js 15, Prisma, SQLite).

## Quick start

```bash
npm install
cp .env.example .env   # then set AUTH_SECRET (and DATABASE_URL if needed)
npx prisma db push
npm run db:ensure-if-empty   # catalog + programs + seed user if DB is empty (or: npm run db:seed)
npm run dev
```

Open [http://localhost:3500](http://localhost:3500). For LAN access: `npm run dev:lan`, and add `ALLOWED_DEV_ORIGINS=<LAN-IP>` to `.env` (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)).

**Docs:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (setup, scripts, layout), [docs/TESTING.md](docs/TESTING.md), [docs/MOBILE_QA.md](docs/MOBILE_QA.md).

**Git + server deploy:** [docs/GIT_DEPLOY.md](docs/GIT_DEPLOY.md) · **DigitalOcean droplet (prebuilt image):** [docs/DIGITALOCEAN_DROPLET.md](docs/DIGITALOCEAN_DROPLET.md) · **Docker / Compose:** [docs/DEPLOY.md](docs/DEPLOY.md).

## Testing

```bash
npm run test:run   # Vitest
npm run test:e2e   # Playwright (install browsers: npx playwright install chromium)
```

## Deploy

- **Docker Compose:** [docs/DEPLOY.md](docs/DEPLOY.md)
- **Push code with Git, pull on a VM, run Compose:** [docs/GIT_DEPLOY.md](docs/GIT_DEPLOY.md)
- **Droplet + GHCR (no build on server):** [docs/DIGITALOCEAN_DROPLET.md](docs/DIGITALOCEAN_DROPLET.md)
