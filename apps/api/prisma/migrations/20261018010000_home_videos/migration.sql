-- CreateTable
CREATE TABLE "home_videos" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_videos_legacyId_key" ON "home_videos"("legacyId");

-- CreateIndex
CREATE INDEX "home_videos_isActive_createdAt_idx" ON "home_videos"("isActive", "createdAt");

-- Seed legacy Rakkacash
INSERT INTO "home_videos" ("id", "legacyId", "youtubeId", "title", "subtitle", "websiteUrl", "isActive", "createdAt", "updatedAt")
VALUES (
  'cmlegacyhomevideo000000001',
  2,
  '8lJ9J3cRb9A',
  'Rakkacash : la solution fintech qui révolutionne l’inclusion financière en RDC',
  'Interview exclusive de Fintech Médias avec Muriel Muhigirwa, BGFIBank RDC.',
  'https://fintechmedias.cd/accueil',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
