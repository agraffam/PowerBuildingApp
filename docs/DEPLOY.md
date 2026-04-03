# Deploy for testing

The app uses **SQLite** (`DATABASE_URL`). Data survives container restarts only if the database file lives on a **persistent volume** or disk mount. Serverless hosts without a writable disk (default Vercel) are not suitable unless you switch the database (for example Postgres or Turso).

**Oracle Cloud + Ubuntu 22.04:** see [OCI_UBUNTU.md](./OCI_UBUNTU.md) (subnets, security lists, Docker, git/rsync, Compose).

**DigitalOcean droplet (prebuilt image, no build on server):** see [DIGITALOCEAN_DROPLET.md](./DIGITALOCEAN_DROPLET.md).

## Docker Compose (fastest locally)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. From the project root:

   ```bash
   # Strong secret for anything beyond local testing:
   export AUTH_SECRET="your-random-string-at-least-16-chars"

   docker compose up --build
   ```

   On a **new empty volume**, the entrypoint runs `prisma db push`, then if the database has **no exercises** it runs the full seed (exercise catalog, prebuilt programs, `dev@seed.local` / `Seed12345678`). To **force** a full re-seed instead (e.g. you want to reset templates), use `START_SEED=1 docker compose up --build` (avoid on a DB that already has data you care about).

   The Compose file maps **host port 3500** → container 3000 by default. To use another port:

   ```bash
   HOST_PORT=3040 docker compose up --build
   ```

3. Open [http://localhost:3500](http://localhost:3500) (or your `HOST_PORT`). Later runs: `docker compose up` (omit `START_SEED` so you do not reset seed expectations).

The SQLite file is stored in the Docker volume `pb-sqlite` (see `docker-compose.yml`).

### Restart vs full reset

| Goal | Command |
|------|---------|
| Rebuild and restart the app **keeping** your SQLite data | `docker compose down` then `docker compose up --build -d` |
| **Wipe the database** and start fresh (auto-seed catalog + programs on first boot) | `docker compose down -v` then `docker compose up --build -d` |

The `-v` flag removes the named volume `pb-sqlite`; the next `up` creates an empty DB and the entrypoint runs `prisma db push` again.

**Stale browser session:** After a volume reset, your old login cookie may still point at a user id that no longer exists. You will get **401** from APIs until you **sign out** (or clear site data) and **register / log in** again—or use the seed user after a fresh seed (`dev@seed.local` / `Seed12345678`).

**Existing Docker volume that was created before auto-seed:** If your DB has tables but **zero exercises**, restart once with a rebuilt image (`docker compose up --build`) so the entrypoint runs `ensure-seed-if-empty`, or run manually: `docker compose exec web npm run db:ensure-if-empty` (or `npm run db:seed`).

### Port 3500 conflicts

Compose maps **host `3500` → container `3000`** by default. If `npm run dev` (or anything else) is already using 3500 on your Mac, either stop it or run:

```bash
HOST_PORT=3501 docker compose up --build -d
```

### DATABASE_URL in Compose

The Compose file sets `DATABASE_URL=file:/app/data/prod.db` inside the container so a **host** `DATABASE_URL` (for example `file:./prisma/dev.db` from local `.env`) does not override it. For custom Docker deployments, change the value in `docker-compose.yml` or your orchestrator config explicitly.

## Fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and run `fly auth login`.
2. Create a volume in the same region you will deploy to (example region `iad`):

   ```bash
   fly volumes create pb_data --region iad --size 1
   ```

3. Create the app (if you have not already): `fly launch --no-deploy` and align `fly.toml` **app** name and `primary_region` with the volume region. Or set `app` in `fly.toml` before deploy.
4. Set secrets:

   ```bash
   fly secrets set AUTH_SECRET="$(openssl rand -base64 32)"
   fly secrets set DATABASE_URL="file:/app/data/prod.db"
   ```

5. `fly deploy`

6. One-time seed (optional): `fly ssh console -C "cd /app && npx prisma db seed"`

## Environment variables

| Variable                 | Required | Notes                                                                 |
|--------------------------|----------|-----------------------------------------------------------------------|
| `AUTH_SECRET`            | Yes      | Min 16 characters; signs session cookies.                             |
| `DATABASE_URL`           | Yes      | e.g. `file:/app/data/prod.db` in Docker/Fly.                         |
| `SESSION_COOKIE_SECURE`  | No       | `true` / `false` forces the `Secure` cookie flag. If unset, the app uses `x-forwarded-proto` (HTTPS → secure). Plain `http://` on a phone to your LAN IP stays **non-secure** so Safari will store the session cookie. |

`NODE_ENV=production` is set in the image.

## Local development (no Docker)

After `npx prisma db push`, if **Exercises** and **Programs** are empty, run:

```bash
npm run db:ensure-if-empty
```

(or `npm run db:seed` once). Your `.env` `DATABASE_URL` must point at the SQLite file you pushed (e.g. `file:./prisma/dev.db`).
