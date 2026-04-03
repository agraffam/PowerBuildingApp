# Development

## Prerequisites

- Node.js 20+ (tested on current LTS; Node 25 works locally)
- npm

## Setup

```bash
npm install
```

This runs `prisma generate` via `postinstall`. The app uses **Prisma 6** with SQLite and a `DATABASE_URL` in `.env` (see repo root). The schema uses the classic `datasource.url` form; **do not upgrade to Prisma 7** without migrating the config format (see [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)).

```bash
npx prisma db push
npm run db:seed
```

## Run the app

```bash
npm run dev          # http://localhost:3500 (Turbopack)
npm run dev:lan      # bind 0.0.0.0:3500 for phone / LAN testing
```

### Phone / LAN (Next.js `allowedDevOrigins`)

If pages (e.g. **Programs**) fail or assets don’t load when you use `http://<your-LAN-IP>:<port>`, set **`ALLOWED_DEV_ORIGINS`** in `.env` (comma-separate several hosts). You can use the IP only, `IP:port`, or a full origin; values are normalized to the hostname Next compares to the browser’s `Origin`:

```bash
ALLOWED_DEV_ORIGINS=192.168.68.59
# or: 192.168.68.59:3500,http://10.0.0.5:3500
```

Restart the dev server after changing `.env`. `next.config.ts` loads `.env` via `@next/env` so this variable is picked up reliably. See [allowedDevOrigins](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins).

### Multiple devices (sign-in is not “one at a time”)

Sessions are **signed JWTs** stored in an **HTTP-only cookie per browser** (`pb_session`). The server does **not** keep a single “active session” per user or revoke other devices when you log in somewhere new. **Phone, tablet, and laptop can all stay signed in at once**, as long as each one has completed login on that browser.

What often feels like “only one device works” in local/LAN dev is **cookie scope**: a cookie set for `http://localhost:3500` is **not** sent to `http://192.168.x.x:3500`, and vice versa. Use the **same hostname** everywhere (for example always your LAN IP with `npm run dev:lan`), or simply **sign in separately** on each URL—both sessions remain valid and map to the same account and data.

After a correct password, sign-in uses a **full page load** to the home page so **Safari on iPhone** reliably applies the session cookie before the next request. The login API also sets the cookie on the **JSON response** (`NextResponse.cookies`) so `Set-Cookie` is not lost on mobile.

## Project layout

| Path | Role |
| --- | --- |
| `src/app/` | Next.js App Router pages and `route.ts` API handlers |
| `src/components/` | React UI, including `training/` workout views |
| `src/lib/` | Domain helpers (calculators, periodization, Prisma queries) |
| `prisma/` | `schema.prisma`, `seed.ts`, local `dev.db` (gitignored) |
| `e2e/` | Playwright smoke tests (mobile viewport) |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `dev:lan` | Development server |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:push` | Push schema to SQLite |
| `npm run db:seed` | Seed catalog and sample program |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest CI run |
| `npm run test:e2e` | Playwright (starts dev server on port 3333 by default) |

Environment variables for Playwright:

- `PLAYWRIGHT_PORT` — dev server port (default `3333`)
- `PLAYWRIGHT_BASE_URL` — full origin if the server is already running
- `CI=1` — stricter Playwright settings (retries, no server reuse)

See [TESTING.md](./TESTING.md) for browser install (`npx playwright install chromium`).

## Further reading

- [MOBILE_QA.md](./MOBILE_QA.md) — manual checks on iPhone-sized layouts
