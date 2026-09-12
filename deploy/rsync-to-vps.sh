#!/usr/bin/env bash
# Sync le dépôt vers /opt/magazine (sans .env, certs, mobile, node_modules).
# Usage : SSH_KEY_FILE=~/.ssh/opt1mum_deploy ./deploy/rsync-to-vps.sh HOST USER [PORT]
set -euo pipefail

HOST="${1:?host requis}"
USER="${2:?user requis}"
PORT="${3:-22}"
KEY="${SSH_KEY_FILE:-$HOME/.ssh/deploy_key}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$KEY" ]]; then
  echo "ERREUR : clé SSH introuvable ($KEY)"
  exit 1
fi

rsync -az --delete \
  --exclude-from="$ROOT/deploy/rsync-exclude" \
  -e "ssh -i $KEY -p $PORT -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$ROOT/" "${USER}@${HOST}:/opt/magazine/"
