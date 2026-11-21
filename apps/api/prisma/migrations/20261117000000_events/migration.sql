-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'SUMMIT', 'MEETUP', 'WEBINAR', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'CONFERENCE',
    "format" "EventFormat" NOT NULL DEFAULT 'IN_PERSON',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "organizer" TEXT,
    "city" TEXT,
    "country" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "mapUrl" TEXT,
    "onlineUrl" TEXT,
    "ticketUrl" TEXT,
    "coverKey" TEXT,
    "programme" JSONB,
    "speakers" JSONB,
    "ticketTiers" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "ticketClicks" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sponsors" (
    "eventId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "tier" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_sponsors_pkey" PRIMARY KEY ("eventId","sponsorId")
);

-- CreateTable
CREATE TABLE "event_daily_stats" (
    "eventId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "ticketClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_daily_stats_pkey" PRIMARY KEY ("eventId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "events"("status", "startsAt");

-- CreateIndex
CREATE INDEX "events_city_idx" ON "events"("city");

-- CreateIndex
CREATE INDEX "event_sponsors_sponsorId_idx" ON "event_sponsors"("sponsorId");

-- CreateIndex
CREATE INDEX "event_daily_stats_day_idx" ON "event_daily_stats"("day");

-- AddForeignKey
ALTER TABLE "event_sponsors" ADD CONSTRAINT "event_sponsors_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sponsors" ADD CONSTRAINT "event_sponsors_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_daily_stats" ADD CONSTRAINT "event_daily_stats_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

