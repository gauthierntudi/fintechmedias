#!/usr/bin/env bash
# Sync le dépôt vers /opt/magazine (sans .env, certs, mobile, node_modules).
# Usage :
#   SSH_KEY_FILE=~/.ssh/opt1mum_deploy ./deploy/rsync-to-vps.sh HOST USER [PORT]
#   ou ssh-agent déjà chargé (GitHub Actions).
set -euo pipefail

HOST="${1:?host requis}"
USER="${2:?user requis}"
PORT="${3:-22}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SSH_CMD=(ssh -p "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_KEY_FILE:-}" ]]; then
  if [[ ! -f "$SSH_KEY_FILE" ]]; then
    echo "ERREUR : clé SSH introuvable ($SSH_KEY_FILE)"
    exit 1
  fi
  SSH_CMD+=(-i "$SSH_KEY_FILE" -o IdentitiesOnly=yes)
elif [[ -f "$HOME/.ssh/deploy_key" ]]; then
  SSH_CMD+=(-i "$HOME/.ssh/deploy_key" -o IdentitiesOnly=yes)
fi

rsync -az --delete \
  --exclude-from="$ROOT/deploy/rsync-exclude" \
  -e "${SSH_CMD[*]}" \
  "$ROOT/" "${USER}@${HOST}:/opt/magazine/"
