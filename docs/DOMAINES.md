# Domaines

## Production (cible Cloudflare — Fintech Médias)

| Hôte | Rôle |
|------|------|
| `fintechmedias.com` / `www.fintechmedias.com` | Front Next.js (Container via Worker gateway) |
| `api.fintechmedias.com` | NestJS + callback FlexPaie (même gateway, route `/api`) |
| `cdn.fintechmedias.com` | Médias R2 |
| `fintechmedias.cd` | Redirection / CNAME vers `.com` (cutover) |

Callback FlexPaie : `https://api.fintechmedias.com/api/payments/flexpaie/callback`  
Resend : `noreply@fintechmedias.com` (domaine déjà vérifié)

### Checklist cutover Cloudflare

1. [ ] Zone DNS `fintechmedias.com` sur Cloudflare
2. [ ] Custom domains Workers → gateway
3. [ ] D1 `fintechdb` + migrations (`deploy/cloudflare`)
4. [ ] Redis managé + secrets (JWT, R2, FlexPaie, Resend, `DATA_WORKER_SECRET`)
5. [ ] Mettre à jour callback FlexPaie
6. [ ] `fintechmedias.cd` → `.com`
7. [ ] Smoke `/`, `/api/health`, login, OTP

Détail : [deploy/cloudflare/README.md](../deploy/cloudflare/README.md)

---

## Ancienne production VPS (L'Entrevue — référence)

| Hôte | Rôle |
|------|------|
| `lentrevuemag.com` / `www.lentrevuemag.com` | Front Next.js |
| `api.lentrevuemag.com` | NestJS + callback FlexPaie |
| `cdn.lentrevuemag.com` | Médias R2 |

VPS : `51.254.214.47`

### Checklist cutover VPS (historique)

1. [ ] DNS `lentrevuemag.com` / `www` / `api` → A `51.254.214.47`
2. [ ] `cdn.lentrevuemag.com` lié au bucket R2 (Cloudflare)
3. [ ] Mettre à jour `.env` (`APP_URL`, `API_URL`, `COOKIE_DOMAIN`, callbacks)
4. [ ] Nginx `server_name`
5. [ ] Recréer le callback FlexPaie sur les nouvelles URLs
6. [ ] Vérifier domaine Resend
7. [ ] Certificat Let’s Encrypt
