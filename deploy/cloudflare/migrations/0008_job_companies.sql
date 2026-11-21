-- Annuaire des entreprises fintech (alimenté automatiquement par les offres d’emploi).
-- CreateTable
CREATE TABLE "job_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "logoKey" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "job_companies_slug_key" ON "job_companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "job_companies_nameKey_key" ON "job_companies"("nameKey");

-- AlterTable (ajout de colonne plutôt que reconstruction de la table jobs)
ALTER TABLE "jobs" ADD COLUMN "companyId" TEXT REFERENCES "job_companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");
