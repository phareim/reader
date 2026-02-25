# Cloudflare D1 Schema

This directory contains SQL files for the Cloudflare D1 schema.

## Files

### 1. `d1-schema.sql`
Creates all tables, indexes, and triggers in D1.

**Run this** using Wrangler:
1. Create the D1 database in Cloudflare
2. Apply the schema:
   ```bash
   wrangler d1 execute <db-name> --file=database/d1-schema.sql
   ```

### Data Migration
If you need to migrate data from another source, write a one-off script that inserts into D1 and uploads article content to R2.

## Migration Order

Follow this exact order:

1. ✅ Create the D1 database
2. ✅ Run `database/d1-schema.sql`
3. ✅ Verify data via Wrangler or D1 dashboard

## What Gets Created

### Tables
- `User` - Application users
- `Feed` - RSS feed subscriptions
- `Article` - Article metadata (content stored in R2)
- `Tag` - User-created tags
- `SavedArticle` - Saved articles for later reading (notes stored in R2)
- `FeedTag` - Many-to-many: Feeds ↔ Tags
- `SavedArticleTag` - Many-to-many: Saved Articles ↔ Tags

### Indexes
All performance indexes from the SQL schema are recreated for optimal query performance.

## Rollback

If something goes wrong:

1. Keep your source database intact (don't delete it)
2. You can drop all D1 tables and start over
3. Ensure you also clean up any R2 objects created for article content

## Support
See the migration plan at: `.claude/plans/dazzling-percolating-puddle.md`
