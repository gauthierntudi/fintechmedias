# Architecture — MAGAZINE v2

## Vue d’ensemble

```
Internet
   │
   ├─ Cloudflare (DNS)
   │
   ▼
DigitalOcean Droplet (Docker Compose)
├─ nginx          :80 / :443  (reverse proxy + TLS)
├─ web            :3000       Next.js 16     → https://entrevue.com
├─ api            :3001       NestJS         → https://api.entrevue.com
└─ worker                     même image NestJS, process BullMQ
         │
         ├── Managed PostgreSQL (Prisma)
         ├── Managed Redis (cache + queues BullMQ)
         └── Cloudflare R2 (PDF, covers, images)
```

Domaines :

| Hôte | Service |
|------|---------|
| `entrevue.com` / `www.entrevue.com` | Front Next.js |
| `api.entrevue.com` | API NestJS (+ callback FlexPaie) |
| `cdn.entrevue.com` (optionnel) | Médias R2 |

## Applications

### `apps/web` — Next.js 16

- Site public : home, kiosque, actualités, pricing, profil, lecture PDF
- Espace abonné : abonnements, achats, notifications, settings
- Admin (`/admin`) : magazines, formules, abonnés, actualités, paiements
- TanStack Query pour le data fetching
- React Hook Form + Zod pour les formulaires
- PDF.js pour le lecteur (remplace `flip/` / turn.js)

### `apps/api` — NestJS

Modules prévus :

| Module | Responsabilité |
|--------|----------------|
| `auth` | Inscription, login, reset password, Google OAuth, JWT/session |
| `users` | Abonnés + users admin (rôles) |
| `magazines` | CRUD magazines, accès lecture selon abo/achat |
| `subscriptions` | Formules, abonnements, renouvellement |
| `payments` | FlexPaie (Mobile Money) — callback + idempotence |
| `articles` | Actualités, commentaires, catégories |
| `media` | Upload signé R2, métadonnées fichiers |
| `notifications` | Emails transactionnels via **Resend** + queue BullMQ |
| `admin` | Endpoints réservés back-office |

### Worker BullMQ

Même codebase NestJS, entrypoint `worker` :

- Envoi emails via **Resend** (activation, facture, reset password)
- Renouvellement / expiration abonnements
- Optimisation images / préparation PDF après upload
- Transcodage vidéo des rubriques interview (FFmpeg → HLS multi-qualité sur R2)
- Traitement webhooks paiement asynchrones si besoin

## Stockage R2

| Préfixe | Contenu |
|---------|---------|
| `magazines/pdf/` | PDF complets |
| `magazines/preview/` | Extraits / previews |
| `covers/` | Couvertures magazines |
| `articles/` | Images articles |
| `videos/{articleId}/` | Source MP4 + poster + HLS (`hls/master.m3u8`) |
| `profiles/` | Avatars abonnés |
| `slides/` | Bannières home |

Accès : URLs publiques CDN R2 pour covers/images ; URLs signées temporaires pour PDF payants.

## Paiements (v2)

| Canal | Provider | Usage |
|-------|----------|--------|
| Mobile Money | **FlexPaie** | Paiement mobile (Airtel, Orange, M-Pesa, etc.) + callback |

Le legacy (MaxiCash, PayPal, MoMo) **n’est pas repris**. Les abonnements / achats existants restent en base ; les nouveaux paiements passent uniquement par FlexPaie.

Flux type :

1. Client saisit son numéro Mobile Money
2. API Nest crée une intention de paiement (`Payment` en DB, statut `PENDING`)
3. Push USSD / OTP FlexPaie
4. Callback → validation idempotente → activation abo ou achat
5. Job BullMQ : email facture / confirmation

## Auth

- Abonnés (`Subscriber`) et staff (`AdminUser`) séparés côté modèle
- JWT (access + refresh) ou sessions HTTP-only cookies (à trancher au scaffold)
- Hash existants bcrypt (`$2y$10$…`) réutilisables tels quels avec bcrypt Node

## Environnements

| Env | Usage |
|-----|--------|
| `development` | Docker Compose local (Postgres + Redis locaux possibles) |
| `staging` | Droplet ou même Droplet, domaine staging |
| `production` | Droplet prod + Managed Postgres/Redis + R2 |
