#!/usr/bin/env bash
# Premier run sur un VPS vide : Docker, UFW, certs Let’s Encrypt, stack Compose.
# Usage (depuis /opt/magazine, en sudo ou root) :
#   sudo -E bash deploy/bootstrap-vps.sh
# Prérequis : DNS A lentrevuemag.com / www / api → ce serveur, et un .env prod.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/magazine}"
REPO_URL="${REPO_URL:-git@github.com:gauthierntudi/entrevue.git}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-contact@lentrevuemag.com}"
DOMAINS=(lentrevuemag.com www.lentrevuemag.com api.lentrevuemag.com)

compose() {
  docker compose -f docker-compose.yml -f docker-compose.data.yml "$@"
}

need_sudo() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Relance en root : sudo -E bash $0"
    exit 1
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "==> Docker déjà installé"
    return
  fi
  echo "==> Installation Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl git ufw fail2ban
  curl -fsSL https://get.docker.com | sh
  if id ubuntu >/dev/null 2>&1; then
    usermod -aG docker ubuntu || true
  fi
  if id debian >/dev/null 2>&1; then
    usermod -aG docker debian || true
  fi
}

ensure_ufw() {
  echo "==> UFW 22/80/443"
  ufw allow OpenSSH
  ufw allow 80
  ufw allow 443
  ufw --force enable
}

ensure_repo() {
  mkdir -p "$APP_DIR"
  if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "==> git clone $REPO_URL → $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
  fi
  cd "$APP_DIR"
  chmod +x deploy/bootstrap-vps.sh deploy/remote-deploy.sh
}

ensure_env() {
  cd "$APP_DIR"
  if [[ ! -f .env ]]; then
    echo "ERREUR : $APP_DIR/.env introuvable."
    echo "Copie deploy/.env.example vers .env, renseigne les secrets, relance."
    exit 1
  fi
  mkdir -p deploy/certbot/conf deploy/certbot/www deploy/nginx/local
}

set_nginx_conf() {
  local name="$1"
  cd "$APP_DIR"
  if grep -q '^NGINX_CONF=' .env; then
    sed -i.bak "s/^NGINX_CONF=.*/NGINX_CONF=${name}/" .env
  else
    printf '\nNGINX_CONF=%s\n' "$name" >> .env
  fi
}

issue_certs() {
  cd "$APP_DIR"
  local live="$APP_DIR/deploy/certbot/conf/live/lentrevuemag.com/fullchain.pem"
  if [[ -f "$live" ]]; then
    echo "==> Certificat déjà présent"
    return
  fi

  echo "==> Stack HTTP (ACME)"
  set_nginx_conf default.http.conf
  compose up -d postgres redis
  compose up -d --build web api worker nginx

  echo "==> Attente nginx :80"
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://127.0.0.1/ >/dev/null 2>&1 \
      || curl -fsS -o /dev/null -A certbot http://127.0.0.1/.well-known/acme-challenge/ping >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  echo "==> Certbot Let’s Encrypt"
  local my_ip
  my_ip="$(curl -4 -fsS --max-time 8 https://ifconfig.me || curl -4 -fsS --max-time 8 https://api.ipify.org || true)"
  local args=()
  for d in "${DOMAINS[@]}"; do
    local resolved
    resolved="$(getent ahostsv4 "$d" 2>/dev/null | awk '{print $1; exit}' || true)"
    if [[ -n "$my_ip" && -n "$resolved" && "$resolved" != "$my_ip" ]]; then
      echo "SKIP $d (DNS $resolved ≠ $my_ip)"
      continue
    fi
    echo "  + $d"
    args+=(-d "$d")
  done
  if [[ ${#args[@]} -eq 0 ]]; then
    echo "ERREUR : aucun domaine ne pointe vers ce VPS ($my_ip)."
    exit 1
  fi
  docker run --rm \
    -v "$APP_DIR/deploy/certbot/conf:/etc/letsencrypt" \
    -v "$APP_DIR/deploy/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    "${args[@]}" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --non-interactive \
    --rsa-key-size 4096
}

enable_tls() {
  cd "$APP_DIR"
  echo "==> Nginx TLS"
  set_nginx_conf default.conf
  compose up -d --force-recreate --no-deps nginx
}

migrate() {
  cd "$APP_DIR"
  echo "==> prisma migrate deploy"
  compose exec -T api npx prisma migrate deploy
}

install_renew_cron() {
  local cronf=/etc/cron.d/entrevue-certbot
  cat > "$cronf" <<EOF
# Renouvellement Let’s Encrypt — L'Entrevue
0 3 * * * root docker run --rm -v $APP_DIR/deploy/certbot/conf:/etc/letsencrypt -v $APP_DIR/deploy/certbot/www:/var/www/certbot certbot/certbot renew --quiet && cd $APP_DIR && docker compose -f docker-compose.yml -f docker-compose.data.yml exec -T nginx nginx -s reload
EOF
  chmod 644 "$cronf"
}

need_sudo
ensure_docker
ensure_ufw
ensure_repo
ensure_env
issue_certs
enable_tls
migrate
install_renew_cron

echo "OK — stack en ligne. Vérifier https://lentrevuemag.com et https://api.lentrevuemag.com/api/health"
