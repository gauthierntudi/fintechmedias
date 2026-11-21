-- AlterTable
ALTER TABLE "events" ADD COLUMN "organizerLogoKey" TEXT;
ALTER TABLE "events" ADD COLUMN "coOrganizers" JSONB;
