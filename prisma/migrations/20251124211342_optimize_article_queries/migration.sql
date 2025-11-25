-- CreateIndex
CREATE INDEX "Article_isRead_publishedAt_idx" ON "Article"("isRead", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "SavedArticle_articleId_userId_idx" ON "SavedArticle"("articleId", "userId");
