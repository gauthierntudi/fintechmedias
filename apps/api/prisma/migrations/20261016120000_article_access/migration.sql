-- AlterTable
ALTER TABLE "articles" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "articles" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "articles" ADD COLUMN "priceCents" INTEGER;

-- CreateTable
CREATE TABLE "article_purchases" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_purchases_subscriberId_articleId_key" ON "article_purchases"("subscriberId", "articleId");
CREATE INDEX "article_purchases_subscriberId_idx" ON "article_purchases"("subscriberId");

-- AddForeignKey
ALTER TABLE "article_purchases" ADD CONSTRAINT "article_purchases_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_purchases" ADD CONSTRAINT "article_purchases_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
