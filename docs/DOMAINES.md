# Domaines

## Production

| Hôte | Rôle |
|------|------|
| `lentrevuemag.com` / `www.lentrevuemag.com` | Front Next.js |
| `api.lentrevuemag.com` | NestJS + callback FlexPaie |
| `cdn.lentrevuemag.com` | Médias R2 (custom domain Cloudflare, pas le VPS) |

VPS : `51.254.214.47`

Callback FlexPaie : `https://api.lentrevuemag.com/api/payments/flexpaie/callback`

## Checklist de cutover

1. [ ] DNS `lentrevuemag.com` / `www` / `api` → A `51.254.214.47`
2. [ ] `cdn.lentrevuemag.com` lié au bucket R2 (Cloudflare)
3. [ ] Mettre à jour `.env` (`APP_URL`, `API_URL`, `COOKIE_DOMAIN`, callbacks)
4. [ ] Nginx `server_name`
5. [ ] Recréer le callback FlexPaie sur les nouvelles URLs
6. [ ] Vérifier domaine Resend (`noreply@lentrevuemag.com`)
7. [ ] Certificat Let’s Encrypt pour `lentrevuemag.com` / `www` / `api`
