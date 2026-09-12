#!/usr/bin/env bash
# Rebuild prod sur le VPS après sync des fichiers (GitHub Actions rsync, ou copie manuelle).
# Ne jamais `git clean` : .env, docker-compose.override.yml, certbot et
# deploy/nginx/local/*.conf restent hors git.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/magazine}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERREUR : $APP_DIR/.env introuvable — abort (secrets hors git)."
  exit 1
fi

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo -n docker info >/dev/null 2>&1; then
  DOCKER=(sudo -n docker)
else
  echo "ERREUR : docker inaccessible pour $(id -un) (groupe docker ou sudo -n)."
  exit 1
fi

compose() {
  "${DOCKER[@]}" compose -f docker-compose.yml -f docker-compose.data.yml "$@"
}

if [[ "${DEPLOY_USE_GIT:-0}" == "1" ]]; then
  echo "==> git sync origin/main"
  git remote set-url origin git@github.com:gauthierntudi/entrevue.git
  git fetch origin main
  git reset --hard origin/main
fi

chmod +x deploy/remote-deploy.sh deploy/bootstrap-vps.sh deploy/rsync-to-vps.sh

echo "==> docker compose build (api, web, worker)"
build_ok=0
for attempt in 1 2 3; do
  if compose build api web worker; then
    build_ok=1
    break
  fi
  echo "WARN — compose build échec (essai ${attempt}/3), nouvelle tentative dans 8s"
  sleep 8
done
if [[ "$build_ok" -ne 1 ]]; then
  echo "ERREUR : docker compose build a échoué après 3 essais"
  exit 1
fi

echo "==> docker compose up (sans recréer postgres/redis)"
compose up -d --no-deps --force-recreate api web worker

echo "==> prisma migrate deploy"
compose exec -T api sh -c \
  'if [ -x /app/node_modules/.bin/prisma ]; then /app/node_modules/.bin/prisma migrate deploy; else npx --no-install prisma migrate deploy; fi'

echo "==> recreate nginx (DNS upstream Docker)"
compose up -d --no-deps --force-recreate nginx

echo "==> healthcheck"
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T api node -e \
    "fetch('http://127.0.0.1:3001/api/health').then(async (r)=>{const t=await r.text(); if(!r.ok||!t.includes('\"status\":\"ok\"')) process.exit(1); console.log(t);}).catch(()=>process.exit(1))"; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -eq 1 ]]; then
  echo "OK — API healthy"
else
  echo "WARN — healthcheck API a échoué (vérifier les logs)"
  compose ps
  compose logs api --tail 50
  exit 1
fi
