-- Offres d’emploi (onglet Jobs).
-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLogoKey" TEXT,
    "companyUrl" TEXT,
    "contractType" TEXT NOT NULL DEFAULT 'CDI',
    "workMode" TEXT NOT NULL DEFAULT 'ON_SITE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "locations" TEXT NOT NULL DEFAULT '',
    "deadline" DATETIME,
    "description" TEXT,
    "applyUrl" TEXT,
    "applyEmail" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "applyClicks" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_status_deadline_idx" ON "jobs"("status", "deadline");

-- CreateIndex
CREATE INDEX "jobs_status_publishedAt_idx" ON "jobs"("status", "publishedAt");

