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
    "tags" TEXT NOT NULL DEFAULT '[]',
    "lastFetchedAt" DATETIME,
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "fetchInterval" INTEGER NOT NULL DEFAULT 900,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Feed" ("createdAt", "description", "errorCount", "faviconUrl", "fetchInterval", "id", "isActive", "lastError", "lastFetchedAt", "siteUrl", "title", "updatedAt", "url", "userId") SELECT "createdAt", "description", "errorCount", "faviconUrl", "fetchInterval", "id", "isActive", "lastError", "lastFetchedAt", "siteUrl", "title", "updatedAt", "url", "userId" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE INDEX "Feed_userId_idx" ON "Feed"("userId");
CREATE INDEX "Feed_isActive_idx" ON "Feed"("isActive");
CREATE UNIQUE INDEX "Feed_userId_url_key" ON "Feed"("userId", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
