-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "guestSessionId" TEXT;

-- CreateIndex
CREATE INDEX "Design_guestSessionId_updatedAt_idx" ON "Design"("guestSessionId", "updatedAt");
