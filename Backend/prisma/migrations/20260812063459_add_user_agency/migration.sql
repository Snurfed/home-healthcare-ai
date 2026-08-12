-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agencyId" TEXT;

-- CreateIndex
CREATE INDEX "users_agencyId_idx" ON "users"("agencyId");
