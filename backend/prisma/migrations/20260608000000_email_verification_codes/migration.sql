-- DropForeignKey
ALTER TABLE "PasswordReset" DROP CONSTRAINT "PasswordReset_userId_fkey";

-- DropTable
DROP TABLE "PasswordReset";

-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('VERIFY_EMAIL', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailCode_userId_purpose_idx" ON "EmailCode"("userId", "purpose");

-- CreateIndex
CREATE INDEX "EmailCode_expiresAt_idx" ON "EmailCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailCode" ADD CONSTRAINT "EmailCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
