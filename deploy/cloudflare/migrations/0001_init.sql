-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "address" TEXT,
    "subscriberCode" TEXT,
    "avatarKey" TEXT,
    "emailVerifiedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordResetOtpHash" TEXT,
    "passwordResetOtpExpiresAt" DATETIME,
    "passwordResetOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "notificationsSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriberId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_reads_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "title" TEXT,
    "phone" TEXT,
    "avatarKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sensitiveActionOtpHash" TEXT,
    "sensitiveActionOtpExpiresAt" DATETIME,
    "sensitiveActionOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "sensitiveActionOtpContext" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "durationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "magazines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issueNumber" TEXT,
    "accessType" TEXT NOT NULL DEFAULT 'PAID',
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "coverKey" TEXT,
    "pdfKey" TEXT,
    "previewKey" TEXT,
    "downloadKey" TEXT,
    "pagesStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "pagesCount" INTEGER,
    "pagesError" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "theme" JSONB,
    "highlights" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoKey" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "avatarKey" TEXT,
    "adminUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "authors_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "magazine_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "magazineId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "magazine_pages_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "subscriberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "subscriberId" TEXT NOT NULL,
    "magazineId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "purchases_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchases_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriberId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "article_purchases_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_purchases_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "planId" TEXT,
    "magazineId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT,
    "coverKey" TEXT,
    "coverCaption" TEXT,
    "category" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" DATETIME,
    "authorId" TEXT,
    "bylineAuthorId" TEXT,
    "magazineId" TEXT,
    "sponsorId" TEXT,
    "videoSourceKey" TEXT,
    "videoHlsKey" TEXT,
    "videoPosterKey" TEXT,
    "videoStatus" TEXT NOT NULL DEFAULT 'NONE',
    "videoError" TEXT,
    "videoDurationSec" INTEGER,
    "youtubeUrl" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_bylineAuthorId_fkey" FOREIGN KEY ("bylineAuthorId") REFERENCES "authors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "coverKey" TEXT,
    "coverCaption" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "article_blocks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "body" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "authorName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "comments_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "imageKey" TEXT NOT NULL,
    "linkUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT DEFAULT 'home',
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "newsletter_outbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "newsletter_outbox_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "newsletter_outbox_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "newsletter_subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "socialLinks" JSONB NOT NULL DEFAULT [],
    "contactAddress" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "newsletterSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "placement" TEXT,
    "imageKey" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "refusalReason" TEXT,
    "diffusionStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ad_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "format" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "price7Days" REAL NOT NULL,
    "price15Days" REAL NOT NULL,
    "price30Days" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorType" TEXT NOT NULL,
    "adminId" TEXT,
    "subscriberId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activity_logs_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_legacyId_key" ON "subscribers"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE INDEX "notification_reads_subscriberId_idx" ON "notification_reads"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_subscriberId_notificationId_key" ON "notification_reads"("subscriberId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_legacyId_key" ON "admin_users"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plans_legacyId_key" ON "plans"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "magazines_legacyId_key" ON "magazines"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "authors_adminUserId_key" ON "authors"("adminUserId");

-- CreateIndex
CREATE INDEX "magazine_pages_magazineId_idx" ON "magazine_pages"("magazineId");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_pages_magazineId_pageNumber_key" ON "magazine_pages"("magazineId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_legacyId_key" ON "subscriptions"("legacyId");

-- CreateIndex
CREATE INDEX "subscriptions_subscriberId_idx" ON "subscriptions"("subscriberId");

-- CreateIndex
CREATE INDEX "subscriptions_status_expiresAt_idx" ON "subscriptions"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_legacyId_key" ON "purchases"("legacyId");

-- CreateIndex
CREATE INDEX "purchases_subscriberId_idx" ON "purchases"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_subscriberId_magazineId_key" ON "purchases"("subscriberId", "magazineId");

-- CreateIndex
CREATE INDEX "article_purchases_subscriberId_idx" ON "article_purchases"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "article_purchases_subscriberId_articleId_key" ON "article_purchases"("subscriberId", "articleId");

-- CreateIndex
CREATE INDEX "payments_subscriberId_idx" ON "payments"("subscriberId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerRef_key" ON "payments"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "articles_legacyId_key" ON "articles"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_isPublished_publishedAt_idx" ON "articles"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "articles_isFeatured_isPublished_idx" ON "articles"("isFeatured", "isPublished");

-- CreateIndex
CREATE INDEX "articles_isFeatured_featuredAt_idx" ON "articles"("isFeatured", "featuredAt");

-- CreateIndex
CREATE INDEX "articles_magazineId_idx" ON "articles"("magazineId");

-- CreateIndex
CREATE INDEX "articles_sponsorId_idx" ON "articles"("sponsorId");

-- CreateIndex
CREATE INDEX "articles_bylineAuthorId_idx" ON "articles"("bylineAuthorId");

-- CreateIndex
CREATE INDEX "articles_videoStatus_idx" ON "articles"("videoStatus");

-- CreateIndex
CREATE INDEX "article_blocks_articleId_position_idx" ON "article_blocks"("articleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "comments_legacyId_key" ON "comments"("legacyId");

-- CreateIndex
CREATE INDEX "comments_articleId_idx" ON "comments"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "slides_legacyId_key" ON "slides"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_messages_legacyId_key" ON "contact_messages"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribeToken_key" ON "newsletter_subscriptions"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_createdAt_idx" ON "newsletter_subscriptions"("createdAt");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_isActive_idx" ON "newsletter_subscriptions"("isActive");

-- CreateIndex
CREATE INDEX "newsletter_outbox_status_createdAt_idx" ON "newsletter_outbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "newsletter_outbox_sentAt_idx" ON "newsletter_outbox"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_outbox_articleId_subscriptionId_key" ON "newsletter_outbox"("articleId", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "advertisements_legacyId_key" ON "advertisements"("legacyId");

-- CreateIndex
CREATE INDEX "advertisements_placement_diffusionStatus_idx" ON "advertisements"("placement", "diffusionStatus");

-- CreateIndex
CREATE INDEX "advertisements_validationStatus_idx" ON "advertisements"("validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ad_rates_legacyId_key" ON "ad_rates"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_rates_format_key" ON "ad_rates"("format");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_adminId_idx" ON "activity_logs"("adminId");

-- CreateIndex
CREATE INDEX "activity_logs_subscriberId_idx" ON "activity_logs"("subscriberId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_actorType_idx" ON "activity_logs"("actorType");

