-- Annuaire des entreprises fintech (alimenté automatiquement par les offres d’emploi).
-- CreateTable
CREATE TABLE "job_companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "logoKey" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_companies_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_companies_slug_key" ON "job_companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "job_companies_nameKey_key" ON "job_companies"("nameKey");

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "job_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
