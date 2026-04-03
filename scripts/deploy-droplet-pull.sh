#!/usr/bin/env bash
# On the droplet: pull latest prebuilt image and restart (after git pull or .env PB_IMAGE bump).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f docker-compose.droplet.yml ]]; then
  echo "docker-compose.droplet.yml missing (run from repo root)" >&2
  exit 1
fi
if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "Set AUTH_SECRET in .env or export it in the shell" >&2
  exit 1
fi
if [[ -z "${PB_IMAGE:-}" ]]; then
  echo "Set PB_IMAGE in .env (see droplet.env.example)" >&2
  exit 1
fi
docker compose -f docker-compose.droplet.yml pull
docker compose -f docker-compose.droplet.yml up -d
echo "OK — prebuilt image pulled and stack is up"
