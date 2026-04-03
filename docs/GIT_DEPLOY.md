# Deploy from Git

Everything needed to **build and run** the app lives in this repository **except secrets** (you create `.env` locally or set env vars on the server). Use Git to ship code to your VM (e.g. Oracle Cloud Ubuntu), then Docker Compose to run it.

## What is (and is not) in Git

| In Git | Not in Git (ignored or server-only) |
|--------|-------------------------------------|
| App source, `Dockerfile`, `docker-compose.yml`, `prisma/schema.prisma`, `scripts/` | `.env` — copy from [`.env.example`](../.env.example) |
| Docs, tests | `node_modules/`, `.next/`, local `prisma/dev.db` |
| [`.env.example`](../.env.example) template | Real `AUTH_SECRET` values |

## One-time: create the remote repository

On GitHub (or GitLab, etc.): create an empty **private** repository.

On your laptop, from the project root:

```bash
git status
git add -A
git commit -m "Initial commit: Powerbuild app"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Use **SSH** remote (`git@github.com:...`) if you prefer SSH keys.

## Server (OCI / any Linux) — first deploy

1. **Install Docker** (see [OCI_UBUNTU.md](./OCI_UBUNTU.md) or Docker’s docs).

2. **Clone** (HTTPS with a [personal access token](https://github.com/settings/tokens), or SSH):

   ```bash
   git clone https://github.com/YOUR_USER/YOUR_REPO.git powerbuilding
   cd powerbuilding
   ```

3. **Secrets** — do not commit `.env`. On the server, either:

   ```bash
   cp .env.example .env
   nano .env   # set AUTH_SECRET (long random); DATABASE_URL is ignored by Docker Compose for the web service
   ```

   …or export only what you need and use Compose’s `environment` section / a **`.env` file next to `docker-compose.yml`** that Docker Compose reads automatically (`AUTH_SECRET=...` in that file works for variable substitution in `docker-compose.yml` if you add it).

   For the **included** `docker-compose.yml`, **`AUTH_SECRET`** must be available to Compose. Easiest:

   ```bash
   export AUTH_SECRET="$(openssl rand -base64 32)"
   docker compose up --build -d
   ```

   (Compose already sets `AUTH_SECRET` in YAML from the host env or you can add a server-only `.env` in the project dir with just `AUTH_SECRET=...` — Compose loads `.env` by default for **substitution** in the compose file.)

4. **Run:**

   ```bash
   docker compose up --build -d
   ```

## Updates — everything through Git

On your laptop: edit, commit, push.

On the server:

```bash
cd ~/powerbuilding   # or your clone path
git pull origin main
docker compose up --build -d
```

Or use the helper script (after pull):

```bash
./scripts/deploy-pull-compose.sh
```

## Optional: GitHub Actions (CI only)

Running tests on every push is easy; **deploying** to OCI from Actions usually means **SSH** from the runner to your VM using a **stored private key** as a GitHub secret—do that only if you’re comfortable with that model. This repo does not require Actions for a simple Git pull + Compose workflow on the VM.

## Related

- [OCI_UBUNTU.md](./OCI_UBUNTU.md) — Oracle Cloud + Ubuntu + Docker.
- [DEPLOY.md](./DEPLOY.md) — Compose behaviour, SQLite volume, seed, restarts.
