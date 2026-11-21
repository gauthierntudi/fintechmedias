-- CreateEnum
CREATE TYPE "JobContractType" AS ENUM ('CDI', 'CDD', 'INTERNSHIP', 'FREELANCE', 'CONSULTANCY', 'APPRENTICESHIP', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "JobWorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLogoKey" TEXT,
    "companyUrl" TEXT,
    "contractType" "JobContractType" NOT NULL DEFAULT 'CDI',
    "workMode" "JobWorkMode" NOT NULL DEFAULT 'ON_SITE',
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "locations" TEXT NOT NULL DEFAULT '',
    "deadline" TIMESTAMP(3),
    "description" TEXT,
    "applyUrl" TEXT,
    "applyEmail" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "applyClicks" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_status_deadline_idx" ON "jobs"("status", "deadline");

-- CreateIndex
CREATE INDEX "jobs_status_publishedAt_idx" ON "jobs"("status", "publishedAt");

