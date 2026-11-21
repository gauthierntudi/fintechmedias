-- Paiement hors de l'app : sessions réglées sur la page web /paiement/<id>
CREATE TYPE "CheckoutKind" AS ENUM ('SUBSCRIPTION', 'MAGAZINE', 'ARTICLE', 'STATUS');
CREATE TYPE "CheckoutState" AS ENUM ('OPEN', 'PAID', 'EXPIRED', 'CANCELLED');

CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "kind" "CheckoutKind" NOT NULL,
    "planId" TEXT,
    "magazineId" TEXT,
    "articleId" TEXT,
    "statusId" TEXT,
    "offerId" TEXT,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "state" "CheckoutState" NOT NULL DEFAULT 'OPEN',
    "paymentId" TEXT,
    "returnUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checkout_sessions_subscriberId_createdAt_idx" ON "checkout_sessions"("subscriberId", "createdAt");
CREATE INDEX "checkout_sessions_paymentId_idx" ON "checkout_sessions"("paymentId");

ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
