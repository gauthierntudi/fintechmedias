# Paiements — FlexPaie

Provider retenu pour ENTREVUE (le legacy MaxiCash / PayPal / MoMo n’est pas porté).

| Canal | Provider | Public cible |
|-------|----------|--------------|
| Mobile Money | FlexPaie / FlexPay | RDC / réseaux mobiles locaux |

## Modèle métier unifié

Une seule entité `Payment` côté Prisma / Nest :

```
Payment
├── id
├── provider          FLEXPAIE | LEGACY
├── providerRef       id externe (order FlexPaie…)
├── amountCents
├── currency          USD | CDF | …
├── status            PENDING | SUCCESS | FAILED | CANCELLED | REFUNDED
├── purpose           SUBSCRIPTION | PURCHASE
├── subscriberId
├── planId?           si abonnement
├── magazineId?       si achat unitaire
├── metadata          Json
├── createdAt
└── updatedAt
```

Règle d’or : **toujours** créer `PENDING` en base avant d’appeler le provider.

## FlexPaie (mobile)

### Variables

```bash
FLEXPAIE_MERCHANT=
FLEXPAIE_TOKEN=Bearer ...
FLEXPAIE_MOBILE_API_URL=https://backend.flexpay.cd/api/rest/v1/paymentService
FLEXPAIE_CARD_API_URL=https://cardpayment.flexpay.cd/v1.1/pay
FLEXPAIE_CHECK_API_URL=https://backend.flexpay.cd/api/rest/v1/check
FLEXPAIE_CALLBACK_URL=https://api.entrevue.com/payments/flexpaie/callback
```

> En prod, `FLEXPAIE_CALLBACK_URL` doit être une URL **HTTPS publique**, pas `localhost`.

### Flux

1. Client saisit son téléphone → `POST /payments/flexpaie/create` (abo) ou `POST /payments/flexpaie/purchase` (numéro)
2. API crée `Payment PENDING` + appel `FLEXPAIE_MOBILE_API_URL`
3. Abonné valide sur son mobile (USSD / notification)
4. Callback FlexPaie → validation (éventuellement `CHECK_API`) → `SUCCESS`
5. Job BullMQ : email de confirmation

### Sécurité

- Valider l’authenticité du callback selon la doc marchand
- Idempotence sur la référence transaction
- Timeout → `FAILED` si pas de confirmation

## Front (Next.js)

- Formulaire Mobile Money uniquement
- FlexPaie : téléphone + attente confirmation mobile
- Polling statut `Payment` en complément du callback

## Admin

- Liste filtrable par provider / statut
- Référence FlexPaie pour le support

## Migration des historiques

| Legacy | Action |
|--------|--------|
| MaxiCash / PayPal / MoMo réussis | Migrés sur `Subscription` / `Purchase` (pas rejoués) |
| Paiements `NO_FINISH` | `CANCELLED` / ignorés |
| Nouveaux encaissements | FlexPaie uniquement |

## Checklist

- [ ] Credentials FlexPaie + callback HTTPS prod
- [x] Module Nest `payments`
- [x] UI checkout Mobile Money
- [ ] Premier paiement live de validation
- [ ] Runbook support (litige FlexPaie)
