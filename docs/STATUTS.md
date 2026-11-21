# Statuts (stories)

Bulles éphémères (image / vidéo) en tête de l’accueil mobile. Portage du module
`statuses` de STUDRC (`/Users/mac/Developer/STUDRC/apps/{api,web,mobile}`),
étendu pour que les **abonnés** puissent publier, sur le modèle de la publicité.

## État actuel

| Couche | État | Fichiers |
|---|---|---|
| Données | ✅ `Status`, `StatusSlide`, `StatusOffer`, `StatusPass` ; `PaymentPurpose.STATUS` / `STATUS_PLAN` | `apps/api/prisma/schema.prisma` |
| Migration | ✅ appliquée au prochain `deploy/vps/deploy.sh` (`prisma migrate deploy` sur le Postgres du VPS) | `apps/api/prisma/migrations/20261121000000_statuses/` |
| API | ✅ module `statuses` (public, abonné, admin, tarifs) + paiements FlexPaie | `apps/api/src/statuses/`, `apps/api/src/payments/payments.service.ts` |
| Admin web | ✅ `/admin/statuts` (équipe + modération) et `/admin/statuts/tarifs` | `apps/web/src/app/admin/(console)/statuts/` |
| Mobile | ✅ header, bulles, visionneuse (Sponsorisé, En savoir plus), composer 2 étapes (média → forfait / paiement unique / achat de forfait), « Mes statuts », menu « … » | `apps/mobile/lib/features/statuses/` |

### Endpoints

- Public : `GET /statuses`, `GET /statuses/offers`, `POST /statuses/:id/view`.
- Abonné (JWT) : `GET|POST /me/statuses`, `GET|DELETE /me/statuses/:id`,
  `POST /me/statuses/:id/submit` (`{ billing: PASS | SINGLE, offerId?, phone? }`),
  `POST /me/statuses/:id/pay` (relance Mobile Money), diapos
  `POST /me/statuses/:id/slides`, `PATCH|DELETE /me/statuses/slides/:slideId`,
  `PUT /me/statuses/:id/slides/order`, `POST /me/statuses/slides/:slideId/{image,poster}`,
  `POST /me/statuses/slides/:slideId/video/{presign,complete}`,
  `GET /me/status-passes`, `POST /me/status-passes/checkout` (`{ offerId, phone }`).
- Admin : `/admin/statuses` (CRUD STUDRC, filtres `state` = active | pending |
  awaiting_payment | rejected | draft | expired et `source`), `POST /admin/statuses/:id/approve`,
  `POST /admin/statuses/:id/reject` (`{ reason }`) ; `/admin/status-offers` (CRUD,
  `GET /admin/status-offers/passes`) réservé SUPERADMIN / ADMIN.

## Règles métier

Deux sources (`Status.source`) :

- **ADMIN** — l’équipe crée depuis l’admin. `billing = NONE`, `paymentState = FREE`,
  `moderation = APPROVED`, publication directe.
- **SUBSCRIBER** — un abonné connecté publie depuis l’app (bouton +).
  Créé avec `moderation = PENDING`. Financement (`billing`) :
  - `PASS` : décompte sur un `StatusPass` actif (`expiresAt > now`,
    `usedCount < quota` ou quota null). `paymentState = FREE`.
  - `SINGLE` : un `Payment` (purpose `STATUS`) ; `paymentState` passe à `PAID`
    via le webhook FlexPaie/Stripe existant.

Un statut abonné n’est visible que si `moderation = APPROVED` **et**
`paymentState ∈ {FREE, PAID}` **et** `expiresAt > now`. À l’approbation,
`publishedAt = now` et `expiresAt = now + offer.statusLifetimeHours`.
Refus → `refusalReason` visible par l’abonné. Forfait : la publication est
rendue. Paiement unique déjà réglé : l’abonné corrige et resoumet sans repayer
(sinon remboursement manuel). La validation exige un paiement confirmé.

`StatusOffer` (grille tarifaire gérée par l’admin, comme `AdRate`) :
`kind = SINGLE` (prix d’une publication) ou `PASS` (prix, `quota`, `periodDays`).

## Mobile — notes de build

- iOS minimum relevé à **15.0** (Podfile + projet Xcode), exigé par Xcode 27.
- Avec Xcode 27, compiler avec **Flutter ≥ 3.47.2** (3.44 échoue : « does not
  contain architectures ») : `~/fvm/versions/3.47.2/bin/flutter build ios`.
- Les vidéos de statut envoyées depuis le mobile n’ont pas de vignette (poster)
  générée côté appareil : la bulle affiche la première image disponible ou le logo.

## Reste à implémenter

- **Notifications** (optionnel) : email / push à l’abonné quand son statut est
  validé ou refusé.
- **Remboursements** : manuels depuis « Paiements » (statut payé puis refusé et
  jamais resoumis, ou supprimé par l’abonné avant validation).
