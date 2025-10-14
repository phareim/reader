/*
  Warnings:

  - Added the required column `userId` to the `Feed` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SavedArticle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "articleId" INTEGER NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "SavedArticle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feed" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "siteUrl" TEXT,
    "faviconUrl" TEXT,
    "lastFetchedAt" DATETIME,
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "fetchInterval" INTEGER NOT NULL DEFAULT 900,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Assign all existing feeds to the first user
INSERT INTO "new_Feed" ("id", "userId", "url", "title", "description", "siteUrl", "faviconUrl", "lastFetchedAt", "lastError", "errorCount", "fetchInterval", "isActive", "createdAt", "updatedAt")
SELECT "id", (SELECT "id" FROM "User" LIMIT 1), "url", "title", "description", "siteUrl", "faviconUrl", "lastFetchedAt", "lastError", "errorCount", "fetchInterval", "isActive", "createdAt", "updatedAt" FROM "Feed";

DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE INDEX "Feed_userId_idx" ON "Feed"("userId");
CREATE INDEX "Feed_isActive_idx" ON "Feed"("isActive");
CREATE UNIQUE INDEX "Feed_userId_url_key" ON "Feed"("userId", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SavedArticle_userId_savedAt_idx" ON "SavedArticle"("userId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedArticle_userId_articleId_key" ON "SavedArticle"("userId", "articleId");
