-- CreateEnum
CREATE TYPE "TelegramRemovalOutcome" AS ENUM ('REMOVED', 'ALREADY_NOT_MEMBER', 'SKIPPED_OTHER_ENTITLEMENT', 'MANUAL_REVIEW_REQUIRED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL_CHARGEBACK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TelegramAccessStatus" ADD VALUE 'REVOCATION_PENDING';
ALTER TYPE "TelegramAccessStatus" ADD VALUE 'REVOCATION_FAILED';
ALTER TYPE "TelegramAccessStatus" ADD VALUE 'MANUAL_REVIEW';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TelegramAccess" ADD COLUMN     "lastRevocationAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastRevocationErrorCode" TEXT,
ADD COLUMN     "nextRevocationAttemptAt" TIMESTAMP(3),
ADD COLUMN     "operationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "removalOutcome" "TelegramRemovalOutcome",
ADD COLUMN     "revocationAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revocationReason" TEXT,
ADD COLUMN     "revocationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "revocationStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TelegramAccess_nextRevocationAttemptAt_idx" ON "TelegramAccess"("nextRevocationAttemptAt");
