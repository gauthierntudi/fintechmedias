-- CreateEnum
CREATE TYPE "NewsletterOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "newsletter_subscriptions" ADD COLUMN "unsubscribeToken" TEXT;

UPDATE "newsletter_subscriptions"
SET "unsubscribeToken" = replace(gen_random_uuid()::text, '-', '')
WHERE "unsubscribeToken" IS NULL;

ALTER TABLE "newsletter_subscriptions"
  ALTER COLUMN "unsubscribeToken" SET NOT NULL;

CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribeToken_key"
  ON "newsletter_subscriptions"("unsubscribeToken");

-- CreateTable
CREATE TABLE "newsletter_outbox" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NewsletterOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_outbox_articleId_subscriptionId_key"
  ON "newsletter_outbox"("articleId", "subscriptionId");

CREATE INDEX "newsletter_outbox_status_createdAt_idx"
  ON "newsletter_outbox"("status", "createdAt");

CREATE INDEX "newsletter_outbox_sentAt_idx"
  ON "newsletter_outbox"("sentAt");

ALTER TABLE "newsletter_outbox"
  ADD CONSTRAINT "newsletter_outbox_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "newsletter_outbox"
  ADD CONSTRAINT "newsletter_outbox_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "newsletter_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
