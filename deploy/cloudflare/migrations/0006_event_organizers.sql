-- Logo de l’organisateur principal et co-organisateurs (JSON) de l’événement.
ALTER TABLE "events" ADD COLUMN "organizerLogoKey" TEXT;
ALTER TABLE "events" ADD COLUMN "coOrganizers" JSONB;
