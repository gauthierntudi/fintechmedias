-- Annuaire : secteur, siège, liens App Store / Play Store.
ALTER TABLE "job_companies" ADD COLUMN "sector" TEXT;
ALTER TABLE "job_companies" ADD COLUMN "headquarters" TEXT;
ALTER TABLE "job_companies" ADD COLUMN "appStoreUrl" TEXT;
ALTER TABLE "job_companies" ADD COLUMN "playStoreUrl" TEXT;
