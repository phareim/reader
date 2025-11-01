-- AlterTable
ALTER TABLE "User" ADD COLUMN "mcpToken" TEXT,
ADD COLUMN "mcpTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_mcpToken_key" ON "User"("mcpToken");
