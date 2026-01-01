-- Supabase Database Functions for The Librarian RSS Reader
-- These functions replace complex Prisma queries and transactions
-- Run this AFTER running supabase-schema.sql

-- ============================================================================
-- FUNCTION 1: Get Unread Counts by Feed
-- ============================================================================
-- Replaces: prisma.article.groupBy({ by: ['feedId'], ... })
-- Used in: server/api/feeds/index.get.ts

CREATE OR REPLACE FUNCTION get_unread_counts_by_feed(p_user_id TEXT)
RETURNS TABLE(feed_id BIGINT, unread_count BIGINT) AS $$
  SELECT a.feed_id, COUNT(*)::BIGINT as unread_count
  FROM "Article" a
  INNER JOIN "Feed" f ON f.id = a.feed_id
  WHERE f.user_id = p_user_id AND a.is_read = false
  GROUP BY a.feed_id
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_unread_counts_by_feed IS 'Returns unread article counts grouped by feed for a user';

-- ============================================================================
-- FUNCTION 2: Get Saved Article Counts by Tag
-- ============================================================================
-- Replaces: Raw SQL query in server/api/saved-articles/counts.get.ts
-- Used in: server/api/saved-articles/counts.get.ts

CREATE OR REPLACE FUNCTION get_saved_article_counts_by_tag(p_user_id TEXT)
RETURNS TABLE(name TEXT, count BIGINT) AS $$
  SELECT t.name, COUNT(sat.saved_article_id)::BIGINT as count
  FROM "Tag" t
  INNER JOIN "SavedArticleTag" sat ON sat.tag_id = t.id
  INNER JOIN "SavedArticle" sa ON sa.id = sat.saved_article_id
  WHERE sa.user_id = p_user_id
  GROUP BY t.id, t.name
  ORDER BY t.name
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_saved_article_counts_by_tag IS 'Returns count of saved articles grouped by tag for a user';

-- ============================================================================
-- FUNCTION 3: Save Article with Tag Inheritance
-- ============================================================================
-- Replaces: Complex transaction in server/api/articles/[id]/save.post.ts
-- This implements the tag inheritance logic where saved articles inherit
-- their feed's tags on first save, but preserve existing tags on re-save
-- Used in: server/api/articles/[id]/save.post.ts

CREATE OR REPLACE FUNCTION save_article_with_tags(
  p_user_id TEXT,
  p_article_id BIGINT,
  p_feed_tags TEXT[]
)
RETURNS TABLE(
  saved_article_id BIGINT,
  saved_at TIMESTAMPTZ
) AS $$
DECLARE
  v_saved_article_id BIGINT;
  v_saved_at TIMESTAMPTZ;
  v_existing_tag_count INT;
  v_tag_id BIGINT;
  v_tag_name TEXT;
BEGIN
  -- Upsert saved article (create if new, update saved_at if exists)
  INSERT INTO "SavedArticle" (user_id, article_id, saved_at)
  VALUES (p_user_id, p_article_id, NOW())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET saved_at = NOW()
  RETURNING id, saved_at INTO v_saved_article_id, v_saved_at;

  -- Check if saved article already has tags
  SELECT COUNT(*) INTO v_existing_tag_count
  FROM "SavedArticleTag"
  WHERE saved_article_id = v_saved_article_id;

  -- Only copy feed tags if this is the first save (no existing tags)
  IF v_existing_tag_count = 0 AND array_length(p_feed_tags, 1) > 0 THEN
    -- Loop through each feed tag
    FOREACH v_tag_name IN ARRAY p_feed_tags LOOP
      -- Upsert tag (create if new, get existing if already exists)
      INSERT INTO "Tag" (user_id, name)
      VALUES (p_user_id, v_tag_name)
      ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_tag_id;

      -- Create SavedArticleTag association (skip if already exists)
      INSERT INTO "SavedArticleTag" (saved_article_id, tag_id)
      VALUES (v_saved_article_id, v_tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Return the saved article info
  RETURN QUERY SELECT v_saved_article_id, v_saved_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION save_article_with_tags IS 'Saves an article and inherits feed tags on first save only';

-- ============================================================================
-- FUNCTION 4: Update Feed Tags (Atomic Replacement)
-- ============================================================================
-- Replaces: Transaction in server/api/feeds/[id]/tags.patch.ts
-- Atomically replaces all tags for a feed
-- Used in: server/api/feeds/[id]/tags.patch.ts

CREATE OR REPLACE FUNCTION update_feed_tags(
  p_user_id TEXT,
  p_feed_id BIGINT,
  p_tag_names TEXT[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tag_id BIGINT;
  v_tag_name TEXT;
  v_feed_owner TEXT;
BEGIN
  -- Verify feed belongs to user
  SELECT user_id INTO v_feed_owner
  FROM "Feed"
  WHERE id = p_feed_id;

  IF v_feed_owner IS NULL OR v_feed_owner != p_user_id THEN
    RAISE EXCEPTION 'Feed not found or unauthorized';
  END IF;

  -- Delete all existing FeedTag associations for this feed
  DELETE FROM "FeedTag"
  WHERE feed_id = p_feed_id;

  -- Create new tag associations
  FOREACH v_tag_name IN ARRAY p_tag_names LOOP
    -- Upsert tag
    INSERT INTO "Tag" (user_id, name)
    VALUES (p_user_id, v_tag_name)
    ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_tag_id;

    -- Create FeedTag association
    INSERT INTO "FeedTag" (feed_id, tag_id)
    VALUES (p_feed_id, v_tag_id);
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_feed_tags IS 'Atomically replaces all tags for a feed';

-- ============================================================================
-- FUNCTION 5: Update Saved Article Tags (Atomic Replacement)
-- ============================================================================
-- Replaces: Transaction in server/api/saved-articles/[id]/tags.patch.ts
-- Atomically replaces all tags for a saved article
-- Used in: server/api/saved-articles/[id]/tags.patch.ts

CREATE OR REPLACE FUNCTION update_saved_article_tags(
  p_user_id TEXT,
  p_saved_article_id BIGINT,
  p_tag_names TEXT[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tag_id BIGINT;
  v_tag_name TEXT;
  v_saved_article_owner TEXT;
BEGIN
  -- Verify saved article belongs to user
  SELECT user_id INTO v_saved_article_owner
  FROM "SavedArticle"
  WHERE id = p_saved_article_id;

  IF v_saved_article_owner IS NULL OR v_saved_article_owner != p_user_id THEN
    RAISE EXCEPTION 'Saved article not found or unauthorized';
  END IF;

  -- Delete all existing SavedArticleTag associations
  DELETE FROM "SavedArticleTag"
  WHERE saved_article_id = p_saved_article_id;

  -- Create new tag associations
  FOREACH v_tag_name IN ARRAY p_tag_names LOOP
    -- Upsert tag
    INSERT INTO "Tag" (user_id, name)
    VALUES (p_user_id, v_tag_name)
    ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_tag_id;

    -- Create SavedArticleTag association
    INSERT INTO "SavedArticleTag" (saved_article_id, tag_id)
    VALUES (p_saved_article_id, v_tag_id);
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_saved_article_tags IS 'Atomically replaces all tags for a saved article';

-- ============================================================================
-- FUNCTION 6: Add Manual Article (for MCP)
-- ============================================================================
-- Replaces: Complex transaction in server/api/articles/manual.post.ts
-- Creates/updates article in "Manual Additions" feed and saves it with tags
-- Used in: server/api/articles/manual.post.ts

CREATE OR REPLACE FUNCTION add_manual_article(
  p_user_id TEXT,
  p_title TEXT,
  p_url TEXT,
  p_summary TEXT,
  p_author TEXT,
  p_tag_names TEXT[]
)
RETURNS TABLE(
  article_id BIGINT,
  saved_article_id BIGINT
) AS $$
DECLARE
  v_feed_id BIGINT;
  v_article_id BIGINT;
  v_saved_article_id BIGINT;
  v_tag_id BIGINT;
  v_tag_name TEXT;
  v_existing_article_id BIGINT;
BEGIN
  -- Find or create "Manual Additions" feed
  SELECT id INTO v_feed_id
  FROM "Feed"
  WHERE user_id = p_user_id AND title = 'Manual Additions';

  IF v_feed_id IS NULL THEN
    INSERT INTO "Feed" (user_id, url, title, is_active)
    VALUES (p_user_id, 'manual://additions', 'Manual Additions', true)
    RETURNING id INTO v_feed_id;
  END IF;

  -- Check if article with this URL already exists in the feed
  SELECT id INTO v_existing_article_id
  FROM "Article"
  WHERE feed_id = v_feed_id AND url = p_url;

  IF v_existing_article_id IS NOT NULL THEN
    -- Update existing article
    UPDATE "Article"
    SET
      title = p_title,
      summary = p_summary,
      author = p_author,
      created_at = NOW()
    WHERE id = v_existing_article_id
    RETURNING id INTO v_article_id;
  ELSE
    -- Create new article
    INSERT INTO "Article" (
      feed_id,
      guid,
      title,
      url,
      summary,
      author,
      published_at,
      is_read,
      created_at
    )
    VALUES (
      v_feed_id,
      'manual:' || extract(epoch from NOW())::TEXT,
      p_title,
      p_url,
      p_summary,
      p_author,
      NOW(),
      false,
      NOW()
    )
    RETURNING id INTO v_article_id;
  END IF;

  -- Save the article (upsert)
  INSERT INTO "SavedArticle" (user_id, article_id, saved_at)
  VALUES (p_user_id, v_article_id, NOW())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET saved_at = NOW()
  RETURNING id INTO v_saved_article_id;

  -- Clear existing tags and add new ones
  DELETE FROM "SavedArticleTag"
  WHERE saved_article_id = v_saved_article_id;

  -- Add tags if provided
  IF array_length(p_tag_names, 1) > 0 THEN
    FOREACH v_tag_name IN ARRAY p_tag_names LOOP
      -- Upsert tag
      INSERT INTO "Tag" (user_id, name)
      VALUES (p_user_id, v_tag_name)
      ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_tag_id;

      -- Create SavedArticleTag association
      INSERT INTO "SavedArticleTag" (saved_article_id, tag_id)
      VALUES (v_saved_article_id, v_tag_id);
    END LOOP;
  END IF;

  -- Return article and saved article IDs
  RETURN QUERY SELECT v_article_id, v_saved_article_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_manual_article IS 'Creates/updates a manually added article in the "Manual Additions" feed and saves it with tags';
