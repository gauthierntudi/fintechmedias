-- AlterTable
ALTER TABLE "articles" ADD COLUMN "featuredAt" TIMESTAMP(3);

-- Backfill: les à la une déjà cochées démarrent 30 jours à partir du déploiement
UPDATE "articles"
SET "featuredAt" = NOW()
WHERE "isFeatured" = true AND "featuredAt" IS NULL;

-- CreateIndex
CREATE INDEX "articles_isFeatured_featuredAt_idx" ON "articles"("isFeatured", "featuredAt");
