# Déploiement Cloudflare — Fintech Médias

Stack cible :

| Couche | Service |
|--------|---------|
| Passerelle | Worker `fintech-gateway` |
| Site | Container Next (`WebContainer`) |
| API | Container Nest (`ApiContainer`) |
| Jobs | Container BullMQ (`WorkerContainer`) |
| Base | **D1** `fintechdb` via Worker `fintech-data` |
| Médias | R2 `cdn.fintechmedias.com` |
| Files | Redis managé (Upstash ou équivalent) |

Le schéma Prisma D1 est [`apps/api/prisma/schema.d1.prisma`](../../apps/api/prisma/schema.d1.prisma).  
Le schéma Postgres local (`schema.prisma`) reste pour le dev Docker.

## Prérequis

- Compte Cloudflare (Workers Paid + Containers + D1)
- Docker Desktop (build des images)
- Node 20+ / pnpm 9
- Domaine `fintechmedias.com` en zone Cloudflare

```bash
cd deploy/cloudflare
pnpm install
npx wrangler login
```

## 1. Créer D1 et migrations

```bash
pnpm d1:create
# Copier database_id dans data-worker/wrangler.jsonc

pnpm d1:migrate:local   # smoke local
pnpm d1:migrate:remote  # prod
```

Régénérer le SQL depuis le schéma D1 :

```bash
cd ../../apps/api
DATABASE_URL="file:./dev-d1.db" pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.d1.prisma \
  --script > ../../deploy/cloudflare/migrations/0001_init.sql
```

## 2. Secrets (obligatoire pour l’API)

Sans secrets Worker, le container Nest **ne démarre pas** (JWT) → `/api/*` en 500
`Failed to start container`.

```bash
# 1) Data worker
npx wrangler secret put DATA_WORKER_SECRET --config data-worker/wrangler.jsonc

# 2) Gateway → injectés dans ApiContainer / WorkerContainer
# Créer .env.production avec un DATABASE_URL public (Neon), puis :
pnpm run cf:secrets
```

### Mode D1 (recommandé)

Nest dans les Containers parle à D1 via le data-worker (`D1_PROXY_URL` + `DATA_WORKER_SECRET`)
et l’adaptateur Prisma `apps/api/src/d1/prisma-d1-proxy.adapter.ts`.

```bash
# .env.production
DATABASE_DRIVER=d1
D1_PROXY_URL=https://fintech-data.<account>.workers.dev

pnpm run cf:secrets
pnpm run cf:deploy:data   # endpoint /raw
pnpm run cf:deploy        # API image générée avec schema.d1.prisma
```

Voir [`.env.example`](./.env.example) et [`.env.production.example`](./.env.production.example).

## 3. Déployer

```bash
# 1) Data worker (D1)
pnpm run cf:deploy:data

# 2) Gateway + containers (Docker requis)
pnpm run cf:deploy
```

> Ne pas lancer `pnpm deploy` : c’est une commande pnpm native (publish), pas Wrangler.

Smoke :

- `https://fintech-gateway.<subdomain>.workers.dev/cf-health`
- `https://fintech-data.<subdomain>.workers.dev/health` (header `x-data-secret` si défini)

## 4. Domaines

Dans le dashboard Cloudflare → Workers → Custom domains :

- `fintechmedias.com` / `www` → `fintech-gateway`
- `api.fintechmedias.com` → `fintech-gateway` (le Worker route `/api` vers Nest)

Ou décommenter `routes` dans `wrangler.jsonc`.

Callback FlexPaie :

`https://api.fintechmedias.com/api/payments/flexpaie/callback`

## 5. Brancher Nest sur D1

En prod Cloudflare :

```env
DATABASE_DRIVER=d1
D1_PROXY_URL=…   # URL du data-worker ou service binding
DATA_WORKER_SECRET=…
```

Client : [`apps/api/src/d1/d1-proxy.client.ts`](../../apps/api/src/d1/d1-proxy.client.ts).  
La bascule complète Prisma → proxy D1 se fait progressivement (les lectures/écritures critiques d’abord). En local, garder `DATABASE_URL` Postgres.

## 6. Import des données (Postgres local → D1)

D1 démarre **vide** (schéma seul). Sans import, le site Cloudflare tombe sur les contenus démo du front.

```bash
# 1) Postgres local up + données présentes
cd ../../apps/api
pnpm export:d1
# → deploy/cloudflare/import/pg-to-d1.sql

# 2) Importer dans D1 remote
cd ../../deploy/cloudflare
pnpm exec wrangler d1 execute fintechdb --remote \
  --file=./import/pg-to-d1.sql \
  --config data-worker/wrangler.jsonc
```

En **local**, gardez `DATABASE_URL` Postgres et **ne mettez pas** `DATABASE_DRIVER=d1` dans `.env` (sinon vous visez D1 vide alors que Nest lit encore Prisma/Postgres).

## Dépannage

| Symptôme | Piste |
|----------|--------|
| 503 gateway | Containers pas encore provisionnés (attendre quelques minutes) |
| D1 database_id placeholder | Relancer `pnpm d1:create` et coller l’id |
| Build Docker échoue | Contexte = racine monorepo (`image_build_context`) |
| Worker BullMQ inactif | Vérifier cron `*/5 * * * *` + logs `WorkerContainer` |
