# Deploy on a DigitalOcean Droplet (prebuilt Docker image)

This guide uses a **prebuilt** image: the heavy `npm run build` runs in **GitHub Actions**, not on the small droplet. The server only **pulls** the image and runs **Docker Compose**.

## Overview

| Step | Where | What |
|------|--------|------|
| 1 | GitHub | Push to `main` → **Actions** builds and pushes to **GHCR** (`ghcr.io/...`) |
| 2 | Droplet | Install Docker, clone repo (for compose files + scripts), create `.env` |
| 3 | Droplet | `docker login ghcr.io` (once, if the package is private) |
| 4 | Droplet | `docker compose -f docker-compose.droplet.yml pull && up -d` |
| 5 | Updates | `git pull` + pull script again (or re-run compose pull/up) |

## 1. Keep the project on GitHub

From your laptop, in the repo root:

```bash
git status
git add .
git commit -m "Your message"
git push origin main
```

After the first push with the workflow file, open **GitHub → Actions → Docker publish** and confirm the run is green. Then open **GitHub → Packages** (or the repo’s right sidebar **Packages**) and copy the image URL. It looks like:

`ghcr.io/<your-github-username>/<repository-name-lowercase>:latest`

**Example:** `https://github.com/agraffam/PowerBuildingApp` → image is typically `ghcr.io/agraffam/powerbuildingapp:latest` (GitHub lowercases the repo name for the package).

### Package visibility (private repo)

- If the **container package** is private, the droplet must authenticate to pull:
  ```bash
  echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
  ```
  Create a [Personal Access Token](https://github.com/settings/tokens) with **`read:packages`** (and `write:packages` only if you push from that machine; not needed on the droplet).

## 2. Create the droplet

1. **DigitalOcean → Droplets → Create**
2. **Image:** Ubuntu 22.04 LTS (or 24.04).
3. **Plan:** smallest is fine to start (1 GB RAM); scale up if builds were ever local (they’re not with this flow).
4. **Authentication:** SSH key (recommended).
5. **Firewall (optional but recommended):** allow **SSH (22)** and **HTTP (80)** / **HTTPS (443)** if you will use a reverse proxy; or temporarily allow **Custom TCP 3500** for direct app access (same default as Compose).

## 3. Install Docker on the droplet

SSH in as root or the default user (`root@` or `ubuntu@` depending on image):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and SSH back in, then:

```bash
docker run --rm hello-world
docker compose version
```

## 4. Clone the repo on the droplet

You need the repo for **`docker-compose.droplet.yml`**, **`.env.droplet.example`**, and **`scripts/deploy-droplet-pull.sh`**. You do **not** run `docker build` here.

```bash
cd ~
git clone https://github.com/YOUR_USER/YOUR_REPO.git powerbuilding
cd powerbuilding
```

Use SSH clone if you prefer: `git@github.com:YOUR_USER/YOUR_REPO.git`

## 5. Configure secrets (`.env`)

```bash
cp droplet.env.example .env
nano .env
```

Set:

- **`AUTH_SECRET`** — at least 16 characters, e.g. `openssl rand -base64 32`
- **`PB_IMAGE`** — the GHCR URL from step 1, e.g. `ghcr.io/agraffam/powerbuildingapp:latest`

Docker Compose reads `.env` in this directory for variable substitution. Do **not** commit `.env`.

If the GHCR package is private:

```bash
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## 6. First start (pull prebuilt image)

```bash
chmod +x scripts/deploy-droplet-pull.sh
./scripts/deploy-droplet-pull.sh
```

Or manually:

```bash
docker compose -f docker-compose.droplet.yml pull
docker compose -f docker-compose.droplet.yml up -d
```

Open `http://YOUR_DROPLET_IP:3500` (or whatever you set in `HOST_PORT` in `.env`).

**First empty database:** the container entrypoint runs `prisma db push` and seeds the catalog when needed (see [DEPLOY.md](./DEPLOY.md)). Optional one-time dev user: `START_SEED=1` in `.env` then recreate the container (only for lab setups).

## 7. Updates (code already built in CI)

On your laptop:

```bash
git push origin main
```

Wait for **Docker publish** to finish. On the droplet:

```bash
cd ~/powerbuilding
git pull origin main
./scripts/deploy-droplet-pull.sh
```

That pulls the new `:latest` image and restarts the stack. **SQLite data** stays in the Docker volume `pb-sqlite` unless you remove it with `docker compose ... down -v`.

## 8. Optional: HTTPS and domain

Put **Caddy** or **Nginx** in front on ports 80/443 with Let’s Encrypt, proxy to `127.0.0.1:3500`, and remove public access to 3500 in the firewall.

## Related

- [GIT_DEPLOY.md](./GIT_DEPLOY.md) — Git remotes, auth, generic pull + compose
- [DEPLOY.md](./DEPLOY.md) — SQLite volume, seeds, `AUTH_SECRET`
- [OCI_UBUNTU.md](./OCI_UBUNTU.md) — Same Docker patterns on Oracle Cloud (build-on-server variant)
