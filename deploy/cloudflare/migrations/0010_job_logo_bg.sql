-- Couleur de fond détectée sur le logo des entreprises.
ALTER TABLE "job_companies" ADD COLUMN "logoBg" TEXT;
ALTER TABLE "jobs" ADD COLUMN "companyLogoBg" TEXT;
