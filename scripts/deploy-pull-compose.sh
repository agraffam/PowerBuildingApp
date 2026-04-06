#!/usr/bin/env bash
# Run on the server after `git pull`: rebuild and restart the stack.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f docker-compose.yml ]]; then
  echo "Run from repo root (docker-compose.yml missing)" >&2
  exit 1
fi
if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "Set AUTH_SECRET in the environment or in a .env file beside docker-compose.yml" >&2
  exit 1
fi
docker compose up --build -d
echo "OK — docker compose up --build -d"

echo "==> Pruning unused Docker images ..."
docker image prune -a -f
echo "Done."
