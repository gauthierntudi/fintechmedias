-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CONFERENCE',
    "format" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
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
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "event_sponsors" (
    "eventId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "tier" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("eventId", "sponsorId"),
    CONSTRAINT "event_sponsors_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_sponsors_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_daily_stats" (
    "eventId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "ticketClicks" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("eventId", "day"),
    CONSTRAINT "event_daily_stats_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

