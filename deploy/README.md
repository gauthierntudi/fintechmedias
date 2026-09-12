# Deploy artifacts

Configs VPS (Docker Compose, Nginx, env).

Voir : [../docs/DEPLOIEMENT.md](../docs/DEPLOIEMENT.md) · [../docs/DOMAINES.md](../docs/DOMAINES.md)

Fichiers :

- `nginx/default.conf` — reverse proxy TLS `lentrevuemag.com` + `api.lentrevuemag.com`
- `nginx/default.http.conf` — bootstrap HTTP (Let’s Encrypt, avant les certificats)
- `.env.example` — modèle des variables
- `bootstrap-vps.sh` — premier run (Docker, UFW, Certbot)
- `remote-deploy.sh` — mises à jour (`git pull` + rebuild)
- Certbot volumes : `certbot/conf`, `certbot/www` (créés au premier SSL)
