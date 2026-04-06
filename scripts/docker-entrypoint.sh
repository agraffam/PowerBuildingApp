#!/bin/sh
set -e
DATA_DIR="${PB_DATA_DIR:-/app/data}"

# Docker named volumes are often root-owned; the app user is `node` (uid 1000). Without a chown,
# `prisma db push` cannot create prod.db and the container exits immediately.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec gosu node "$0" "$@"
fi

mkdir -p "$DATA_DIR"

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:${DATA_DIR}/prod.db"
fi

export AUTH_SECRET="${AUTH_SECRET:?Set AUTH_SECRET (min 16 characters)}"

# `db push` may refuse schema updates on existing SQLite files (e.g. new unique on
# Program.seedKey) until this flag is set. Default: allow so droplets upgrade cleanly.
# Set PRISMA_ACCEPT_DATA_LOSS=0 to block and exit (handle schema manually).
prisma_bin="./node_modules/.bin/prisma"
case "${PRISMA_ACCEPT_DATA_LOSS:-1}" in
  0 | false | no | NO)
    "$prisma_bin" db push
    ;;
  *)
    "$prisma_bin" db push --accept-data-loss
    ;;
esac

# Load catalog + programs when DB is empty, or force full seed when START_SEED=1 (not both)
if [ "$START_SEED" = "1" ]; then
  npm run db:seed
else
  npx tsx prisma/ensure-seed-if-empty.ts
fi

exec npx next start --hostname 0.0.0.0 --port "${PORT:-3000}"
