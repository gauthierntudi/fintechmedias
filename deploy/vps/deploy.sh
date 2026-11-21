#!/usr/bin/env bash
# Déploie Fintech Médias sur le VPS Hostinger partagé.
# Usage (depuis la racine du monorepo, sur ta machine) :
#   ./deploy/vps/deploy.sh            # hôte SSH « kadi » par défaut
#   SSH_HOST=autre ./deploy/vps/deploy.sh
#
# Ne touche qu'à /opt/fintechmedias et au projet Compose « fintechmedias ».
# Le .env de prod reste sur le serveur (jamais synchronisé).
set -euo pipefail

SSH_HOST="${SSH_HOST:-kadi}"
APP_DIR="${APP_DIR:-/opt/fintechmedias}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> rsync → ${SSH_HOST}:${APP_DIR}"
ssh "$SSH_HOST" "mkdir -p '$APP_DIR'"
rsync -az --delete \
  --exclude-from="$ROOT/deploy/rsync-exclude" \
  --exclude 'deploy/cloudflare/node_modules' \
  --exclude 'deploy/cloudflare/import' \
  "$ROOT/" "${SSH_HOST}:${APP_DIR}/"

ssh "$SSH_HOST" APP_DIR="$APP_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
cd "$APP_DIR"
[[ -f .env ]] || { echo "ERREUR : $APP_DIR/.env introuvable"; exit 1; }

compose() { docker compose -f docker-compose.vps.yml "$@"; }

echo "==> build"
compose build api web

echo "==> up postgres/redis"
compose up -d --wait postgres redis

echo "==> prisma migrate deploy"
compose run --rm -T --no-deps -e APP_ENTRY=dist/main.js api \
  sh -c 'if [ -x node_modules/.bin/prisma ]; then node_modules/.bin/prisma migrate deploy; else npx --no-install prisma migrate deploy; fi' </dev/null

echo "==> up api/worker/web"
compose up -d --force-recreate api worker web

echo "==> healthcheck"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3011/api/health >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:3011/api/health; echo
    echo "OK — API healthy"
    docker image prune -f >/dev/null || true
    exit 0
  fi
  sleep 2
done
echo "ERREUR — API ne répond pas"
compose ps
compose logs api --tail 80
exit 1
REMOTE
