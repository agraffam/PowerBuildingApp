#!/usr/bin/env bash
# On the droplet: pull latest prebuilt image and restart (after git pull or .env PB_IMAGE bump).
#
# After `docker system prune` (especially -a): your PB_IMAGE layer was removed — this script
# must successfully `pull` again. Private GHCR images require: `docker login ghcr.io`
# (a prune does not remove ~/.docker/config.json, but a new server or logout does).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose (v2 plugin) not found. Install Docker Compose plugin or use: docker compose ..." >&2
  exit 1
fi

# Compose reads .env for YAML substitution; bash does not — load for preflight checks.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
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

echo "==> Pulling ${PB_IMAGE} ..."
docker compose -f docker-compose.droplet.yml pull

echo "==> Starting stack (detached) ..."
# --remove-orphans clears old container names if compose project changed after prune
docker compose -f docker-compose.droplet.yml up -d --remove-orphans

echo "==> Container status:"
docker compose -f docker-compose.droplet.yml ps -a

web_cid="$(docker compose -f docker-compose.droplet.yml ps -q web | head -1 || true)"
web_running="false"
if [[ -n "$web_cid" ]]; then
  web_running="$(docker inspect -f '{{.State.Running}}' "$web_cid" 2>/dev/null || echo false)"
fi
if [[ "$web_running" != "true" ]]; then
  echo "" >&2
  echo "WARNING: service 'web' is not running. Recent logs:" >&2
  docker compose -f docker-compose.droplet.yml logs --tail=80 web >&2 || true
  echo "" >&2
  echo "Common fixes after prune:" >&2
  echo "  - Private image:  docker login ghcr.io   then re-run this script" >&2
  echo "  - Wrong PB_IMAGE: check .env matches your GHCR package name (lowercase)" >&2
  echo "  - See full logs:  docker compose -f docker-compose.droplet.yml logs -f web" >&2
  exit 1
fi

echo "OK — prebuilt image pulled and stack is up"
