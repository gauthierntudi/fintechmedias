-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoKey" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "sponsorId" TEXT;

-- CreateIndex
CREATE INDEX "articles_sponsorId_idx" ON "articles"("sponsorId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
