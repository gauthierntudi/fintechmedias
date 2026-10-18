-- CreateEnum
CREATE TYPE "AdFormat" AS ENUM ('RECTANGLE', 'PORTRAIT', 'PAYSAGE_SMALL', 'PAYSAGE_MEDIUM', 'PAYSAGE_LARGE', 'LARGE_PORTRAIT', 'LARGE_RECTANGLE');
CREATE TYPE "AdValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AdPaymentStatus" AS ENUM ('FREE', 'PAID', 'PENDING');
CREATE TYPE "AdDiffusionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "advertisements" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "title" TEXT NOT NULL,
    "format" "AdFormat" NOT NULL,
    "placement" TEXT,
    "imageKey" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "AdPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "validationStatus" "AdValidationStatus" NOT NULL DEFAULT 'PENDING',
    "refusalReason" TEXT,
    "diffusionStatus" "AdDiffusionStatus" NOT NULL DEFAULT 'INACTIVE',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_rates" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "format" "AdFormat" NOT NULL,
    "dimensions" TEXT NOT NULL,
    "price7Days" DECIMAL(10,2) NOT NULL,
    "price15Days" DECIMAL(10,2) NOT NULL,
    "price30Days" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advertisements_legacyId_key" ON "advertisements"("legacyId");
CREATE INDEX "advertisements_placement_diffusionStatus_idx" ON "advertisements"("placement", "diffusionStatus");
CREATE INDEX "advertisements_validationStatus_idx" ON "advertisements"("validationStatus");
CREATE UNIQUE INDEX "ad_rates_legacyId_key" ON "ad_rates"("legacyId");
CREATE UNIQUE INDEX "ad_rates_format_key" ON "ad_rates"("format");

-- Campagne déjà présente dans le dump PHP
INSERT INTO "advertisements" (
    "id", "legacyId", "title", "format", "placement", "imageKey", "targetUrl", "dimensions",
    "startsOn", "endsOn", "impressions", "views", "clicks", "amountPaid",
    "paymentStatus", "validationStatus", "diffusionStatus", "isLocked", "createdByAdmin",
    "createdAt", "updatedAt"
) VALUES (
    'ad-legacy-4', 4, 'Drépanocytose', 'PORTRAIT', NULL,
    'uploads/ads/699388d2369ac_1771276498.jpg',
    'https://dataxell.com/', '512x562',
    '2026-02-16', '2026-02-28', 109, 109, 1, 1.00,
    'PAID', 'APPROVED', 'ACTIVE', false, false,
    '2025-12-30 01:56:32', '2026-02-28 16:13:13'
);

INSERT INTO "ad_rates" (
    "id", "legacyId", "format", "dimensions", "price7Days", "price15Days", "price30Days", "isActive", "updatedAt"
) VALUES
    ('rate-rectangle', 1, 'RECTANGLE', '672x560', 1.00, 1.00, 50.00, true, '2025-12-30 00:47:20'),
    ('rate-portrait', 2, 'PORTRAIT', '512x562', 1.00, 20.00, 60.00, true, '2025-12-30 01:55:36'),
    ('rate-paysage-small', 3, 'PAYSAGE_SMALL', '1456x180', 3.00, 70.00, 120.00, true, '2026-02-14 02:41:44'),
    ('rate-paysage-medium', 4, 'PAYSAGE_MEDIUM', '1920x400', 60.00, 110.00, 180.00, true, '2025-12-29 01:57:23'),
    ('rate-paysage-large', 5, 'PAYSAGE_LARGE', '3456x502', 80.00, 150.00, 250.00, true, '2025-12-29 01:57:23'),
    ('rate-large-portrait', 6, 'LARGE_PORTRAIT', '768x1024', 2.00, 50.00, 70.00, true, '2026-02-19 04:51:26'),
    ('rate-large-rectangle', NULL, 'LARGE_RECTANGLE', '1024x768', 1.00, 20.00, 50.00, true, CURRENT_TIMESTAMP);
