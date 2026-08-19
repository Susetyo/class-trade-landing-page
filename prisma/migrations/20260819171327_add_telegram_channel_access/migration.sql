-- CreateEnum
CREATE TYPE "TelegramAccessStatus" AS ENUM ('ELIGIBLE', 'INVITED', 'REQUESTED', 'GRANTED', 'REVOKED', 'FAILED');

-- CreateTable
CREATE TABLE "TelegramAccess" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "telegramAccountId" TEXT NOT NULL,
    "status" "TelegramAccessStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "inviteLink" TEXT,
    "inviteLinkHash" TEXT,
    "inviteLinkName" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "joinRequestedAt" TIMESTAMP(3),
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramWebhookEvent" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccess_orderId_key" ON "TelegramAccess"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccess_inviteLinkHash_key" ON "TelegramAccess"("inviteLinkHash");

-- CreateIndex
CREATE INDEX "TelegramAccess_telegramAccountId_idx" ON "TelegramAccess"("telegramAccountId");

-- CreateIndex
CREATE INDEX "TelegramAccess_status_idx" ON "TelegramAccess"("status");

-- CreateIndex
CREATE INDEX "TelegramAccess_inviteExpiresAt_idx" ON "TelegramAccess"("inviteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramWebhookEvent_updateId_key" ON "TelegramWebhookEvent"("updateId");

-- AddForeignKey
ALTER TABLE "TelegramAccess" ADD CONSTRAINT "TelegramAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAccess" ADD CONSTRAINT "TelegramAccess_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
