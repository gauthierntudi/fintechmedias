-- AlterTable
ALTER TABLE "site_settings"
  ADD COLUMN "newsletterSendingEnabled" BOOLEAN NOT NULL DEFAULT false;
