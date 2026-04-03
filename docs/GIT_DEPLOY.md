# Deploy from Git

Everything needed to **build and run** the app lives in this repository **except secrets** (you create `.env` locally or set env vars on the server). Use Git to ship code to your VM, then Docker Compose to run it.

## What is (and is not) in Git

| In Git | Not in Git (ignored or server-only) |
|--------|-------------------------------------|
| App source, `Dockerfile`, `docker-compose.yml`, `prisma/schema.prisma`, `scripts/` | `.env` — copy from [`.env.example`](../.env.example) |
| Docs, tests | `node_modules/`, `.next/`, local `prisma/dev.db` |
| [`.env.example`](../.env.example) template | Real `AUTH_SECRET` values |

## One-time: create the remote repository

This project’s GitHub remote: **https://github.com/agraffam/PowerBuildingApp**

On your laptop, from the project root (first time only):

```bash
git remote add origin https://github.com/agraffam/PowerBuildingApp.git
# or: git remote set-url origin https://github.com/agraffam/PowerBuildingApp.git
git push -u origin main
```

**Authentication:** GitHub no longer accepts account passwords over HTTPS. Use one of:

- **GitHub CLI:** `gh auth login`, then `git push -u origin main`
- **SSH:** `git remote set-url origin git@github.com:agraffam/PowerBuildingApp.git` (add your SSH key in GitHub → Settings → SSH keys), then `git push -u origin main`
- **HTTPS + Personal Access Token:** when prompted for password, paste a [fine-grained or classic token](https://github.com/settings/tokens) with `repo` scope

## Server (Linux) — first deploy

1. **Install Docker** ([Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) or your distro’s docs).

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

## Prebuilt image (DigitalOcean / small VMs)

To **avoid building on the server**, use GitHub Actions → **GHCR** and `docker-compose.droplet.yml`. See **[DIGITALOCEAN_DROPLET.md](./DIGITALOCEAN_DROPLET.md)** for the full droplet walkthrough.

Summary:

1. Push to `main` — **Docker publish** workflow pushes `ghcr.io/<owner>/<repo>:latest`.
2. On the droplet: `.env` with `AUTH_SECRET` and `PB_IMAGE`, then `./scripts/deploy-droplet-pull.sh`.

## Updates — everything through Git

On your laptop: edit, commit, push.

### Option A — Build on the server (default `docker-compose.yml`)

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

### Option B — Prebuilt image (`docker-compose.droplet.yml`)

```bash
cd ~/powerbuilding
git pull origin main
./scripts/deploy-droplet-pull.sh
```

## Optional: GitHub Actions (CI only)

Running tests on every push is easy; **deploying** from Actions to a VM usually means **SSH** from the runner using a **stored private key** as a GitHub secret—only if you want that model. This repo does not require it for Git pull + Compose on the server, and the **Docker publish** workflow only pushes to GHCR.

## Related

- [DIGITALOCEAN_DROPLET.md](./DIGITALOCEAN_DROPLET.md) — DigitalOcean droplet + prebuilt GHCR image.
- [DEPLOY.md](./DEPLOY.md) — Compose behaviour, SQLite volume, seed, restarts.
