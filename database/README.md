# Supabase Migration Files

This directory contains SQL files for migrating from Prisma to Supabase.

## Files

### 1. `supabase-schema.sql`
Creates all tables, indexes, and triggers in Supabase.

**Run this FIRST** in your Supabase SQL Editor:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste the contents of `supabase-schema.sql`
5. Click "Run" or press Cmd/Ctrl + Enter

### 2. `supabase-functions.sql`
Creates database functions for complex queries and transactions.

**Run this SECOND** in your Supabase SQL Editor:
1. Same steps as above, but with `supabase-functions.sql`

### 3. Migration Script (`scripts/migrate-to-supabase.ts`)
TypeScript script that migrates all data from Prisma to Supabase.

**Run this AFTER** the SQL files:

```bash
# Ensure you have these environment variables set:
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# DATABASE_URL (your current Prisma database)

npx tsx scripts/migrate-to-supabase.ts
```

## Migration Order

Follow this exact order:

1. ✅ Run `supabase-schema.sql` in Supabase SQL Editor
2. ✅ Run `supabase-functions.sql` in Supabase SQL Editor
3. ✅ Run the migration script: `npx tsx scripts/migrate-to-supabase.ts`
4. ✅ Verify data in Supabase dashboard
5. ✅ Update your app code to use Supabase (see migration plan)

## What Gets Created

### Tables
- `User` - Application users (linked to Supabase Auth)
- `Feed` - RSS feed subscriptions
- `Article` - Articles from feeds
- `Tag` - User-created tags
- `SavedArticle` - Saved articles for later reading
- `FeedTag` - Many-to-many: Feeds ↔ Tags
- `SavedArticleTag` - Many-to-many: Saved Articles ↔ Tags

### Functions
- `get_unread_counts_by_feed()` - Aggregate unread articles by feed
- `get_saved_article_counts_by_tag()` - Aggregate saved articles by tag
- `save_article_with_tags()` - Save article with tag inheritance
- `update_feed_tags()` - Atomically update feed tags
- `update_saved_article_tags()` - Atomically update saved article tags
- `add_manual_article()` - Add manually created articles (for MCP)

### Indexes
All performance indexes from the Prisma schema are recreated for optimal query performance.

## Rollback

If something goes wrong:

1. Keep your Prisma database intact (don't delete it)
2. You can drop all Supabase tables and start over
3. The migration script is idempotent for most operations

## Support

See the main migration plan at: `.claude/plans/dazzling-percolating-puddle.md`
