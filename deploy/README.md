# Deploy artifacts

Configs VPS (Docker Compose, Nginx, env).

Voir : [../docs/DEPLOIEMENT.md](../docs/DEPLOIEMENT.md) · [../docs/DOMAINES.md](../docs/DOMAINES.md)

Fichiers :

- `nginx/default.conf` — reverse proxy TLS `lentrevuemag.com` + `api.lentrevuemag.com`
- `nginx/default.http.conf` — bootstrap HTTP (Let’s Encrypt, avant les certificats)
- `.env.example` — modèle des variables
- `bootstrap-vps.sh` — premier run (Docker, UFW, Certbot)
- `rsync-exclude` / `rsync-to-vps.sh` — sync GitHub Actions → VPS
- `remote-deploy.sh` — rebuild Compose + migrations (après rsync)
- Certbot volumes : `certbot/conf`, `certbot/www` (créés au premier SSL)
