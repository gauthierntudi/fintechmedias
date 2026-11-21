-- Statuts (stories) : bulles éphémères admin + abonnés (payants, modérés).
-- CreateEnum
CREATE TYPE "StatusSource" AS ENUM ('ADMIN', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "StatusMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "StatusImageFit" AS ENUM ('COVER', 'FIT');

-- CreateEnum
CREATE TYPE "StatusBilling" AS ENUM ('NONE', 'PASS', 'SINGLE');

-- CreateEnum
CREATE TYPE "StatusModeration" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StatusPaymentState" AS ENUM ('FREE', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "StatusOfferKind" AS ENUM ('SINGLE', 'PASS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentPurpose" ADD VALUE 'STATUS';
ALTER TYPE "PaymentPurpose" ADD VALUE 'STATUS_PLAN';

-- CreateTable
CREATE TABLE "statuses" (
    "id" TEXT NOT NULL,
    "source" "StatusSource" NOT NULL DEFAULT 'ADMIN',
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "subscriberId" TEXT,
    "billing" "StatusBilling" NOT NULL DEFAULT 'NONE',
    "paymentState" "StatusPaymentState" NOT NULL DEFAULT 'FREE',
    "paymentId" TEXT,
    "passId" TEXT,
    "offerId" TEXT,
    "moderation" "StatusModeration" NOT NULL DEFAULT 'APPROVED',
    "refusalReason" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_slides" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "mediaType" "StatusMediaType",
    "mediaKey" TEXT,
    "posterKey" TEXT,
    "imageFit" "StatusImageFit" NOT NULL DEFAULT 'COVER',
    "caption" TEXT,
    "linkUrl" TEXT,
    "articleId" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_offers" (
    "id" TEXT NOT NULL,
    "kind" "StatusOfferKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "statusLifetimeHours" INTEGER NOT NULL DEFAULT 24,
    "quota" INTEGER,
    "periodDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_passes" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "offerId" TEXT,
    "paymentId" TEXT,
    "paymentState" "StatusPaymentState" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "quota" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "statuses_paymentId_key" ON "statuses"("paymentId");

-- CreateIndex
CREATE INDEX "statuses_isPublished_expiresAt_idx" ON "statuses"("isPublished", "expiresAt");

-- CreateIndex
CREATE INDEX "statuses_sortOrder_idx" ON "statuses"("sortOrder");

-- CreateIndex
CREATE INDEX "statuses_subscriberId_idx" ON "statuses"("subscriberId");

-- CreateIndex
CREATE INDEX "statuses_moderation_idx" ON "statuses"("moderation");

-- CreateIndex
CREATE INDEX "status_slides_statusId_position_idx" ON "status_slides"("statusId", "position");

-- CreateIndex
CREATE INDEX "status_slides_articleId_idx" ON "status_slides"("articleId");

-- CreateIndex
CREATE INDEX "status_offers_kind_isActive_idx" ON "status_offers"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "status_passes_paymentId_key" ON "status_passes"("paymentId");

-- CreateIndex
CREATE INDEX "status_passes_subscriberId_expiresAt_idx" ON "status_passes"("subscriberId", "expiresAt");

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_passId_fkey" FOREIGN KEY ("passId") REFERENCES "status_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "status_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_slides" ADD CONSTRAINT "status_slides_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_slides" ADD CONSTRAINT "status_slides_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_passes" ADD CONSTRAINT "status_passes_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_passes" ADD CONSTRAINT "status_passes_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "status_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

