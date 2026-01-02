/**
 * Data Migration Script: Prisma to Supabase
 *
 * This script migrates all data from the existing Prisma database to Supabase.
 * It handles users, feeds, articles, tags, saved articles, and all relationships.
 *
 * Prerequisites:
 * 1. Run database/supabase-schema.sql in Supabase SQL Editor
 * 2. Run database/supabase-functions.sql in Supabase SQL Editor
 * 3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 4. Ensure Prisma database is still accessible (DATABASE_URL)
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Validate environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nPlease set them in your .env.local file or environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Migration statistics
const stats = {
  users: 0,
  feeds: 0,
  articles: 0,
  tags: 0,
  savedArticles: 0,
  feedTags: 0,
  savedArticleTags: 0,
  errors: [] as string[]
}

async function migrateUsers() {
  console.log('\n📦 Migrating users...')
  const users = await prisma.user.findMany()

  for (const user of users) {
    try {
      console.log(`  → ${user.email}`)

      // Create Supabase Auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email!,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          image: user.image
        }
      })

      if (authError) {
        // User might already exist in Supabase Auth
        if (authError.message.includes('already registered')) {
          console.log(`    ⚠️  Auth user already exists, looking up by email...`)

          // Try to find existing auth user
          const { data: existingUsers } = await supabase.auth.admin.listUsers()
          const existingUser = existingUsers?.users.find(u => u.email === user.email)

          if (!existingUser) {
            throw new Error(`Could not find or create auth user for ${user.email}`)
          }

          // Use existing auth user
          const { error: userError } = await supabase
            .from('User')
            .insert({
              id: user.id,
              auth_user_id: existingUser.id,
              name: user.name,
              email: user.email,
              email_verified: user.emailVerified?.toISOString(),
              image: user.image,
              created_at: user.createdAt.toISOString(),
              updated_at: user.updatedAt.toISOString(),
              mcp_token: user.mcpToken,
              mcp_token_created_at: user.mcpTokenCreatedAt?.toISOString()
            })

          if (userError) {
            throw userError
          }
        } else {
          throw authError
        }
      } else {
        // Successfully created new auth user
        const { error: userError } = await supabase
          .from('User')
          .insert({
            id: user.id,
            auth_user_id: authUser.user.id,
            name: user.name,
            email: user.email,
            email_verified: user.emailVerified?.toISOString(),
            image: user.image,
            created_at: user.createdAt.toISOString(),
            updated_at: user.updatedAt.toISOString(),
            mcp_token: user.mcpToken,
            mcp_token_created_at: user.mcpTokenCreatedAt?.toISOString()
          })

        if (userError) {
          throw userError
        }
      }

      stats.users++
      console.log(`    ✅ Migrated`)
    } catch (error: any) {
      const errorMsg = `Failed to migrate user ${user.email}: ${error.message}`
      console.error(`    ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)
    }
  }

  console.log(`✅ Migrated ${stats.users} users`)
}

async function migrateFeeds() {
  console.log('\n📦 Migrating feeds...')
  const feeds = await prisma.feed.findMany()

  // Batch insert for better performance
  const BATCH_SIZE = 100
  for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
    const batch = feeds.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from('Feed').insert(
      batch.map(f => ({
        id: f.id,
        user_id: f.userId,
        url: f.url,
        title: f.title,
        description: f.description,
        site_url: f.siteUrl,
        favicon_url: f.faviconUrl,
        last_fetched_at: f.lastFetchedAt?.toISOString(),
        last_error: f.lastError,
        error_count: f.errorCount,
        fetch_interval: f.fetchInterval,
        is_active: f.isActive,
        created_at: f.createdAt.toISOString(),
        updated_at: f.updatedAt.toISOString()
      }))
    )

    if (error) {
      const errorMsg = `Failed to migrate feed batch at ${i}: ${error.message}`
      console.error(`  ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)
    } else {
      stats.feeds += batch.length
      console.log(`  → Migrated ${stats.feeds}/${feeds.length} feeds...`)
    }
  }

  console.log(`✅ Migrated ${stats.feeds} feeds`)
}

async function migrateArticles() {
  console.log('\n📦 Migrating articles...')

  // Get total count for progress reporting
  const totalCount = await prisma.article.count()
  console.log(`  Total articles to migrate: ${totalCount}`)

  const BATCH_SIZE = 1000
  let offset = 0

  while (true) {
    const articles = await prisma.article.findMany({
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' }
    })

    if (articles.length === 0) break

    const { error } = await supabase.from('Article').insert(
      articles.map(a => ({
        id: a.id,
        feed_id: a.feedId,
        guid: a.guid,
        title: a.title,
        url: a.url,
        author: a.author,
        content: a.content,
        summary: a.summary,
        image_url: a.imageUrl,
        published_at: a.publishedAt?.toISOString(),
        is_read: a.isRead,
        is_starred: a.isStarred,
        read_at: a.readAt?.toISOString(),
        created_at: a.createdAt.toISOString()
      }))
    )

    if (error) {
      const errorMsg = `Failed to migrate article batch at offset ${offset}: ${error.message}`
      console.error(`  ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)

      // Continue anyway to migrate as much as possible
      offset += BATCH_SIZE
      continue
    }

    stats.articles += articles.length
    offset += BATCH_SIZE

    const progress = Math.round((stats.articles / totalCount) * 100)
    console.log(`  → Migrated ${stats.articles}/${totalCount} articles (${progress}%)...`)
  }

  console.log(`✅ Migrated ${stats.articles} articles`)
}

async function migrateTags() {
  console.log('\n📦 Migrating tags...')
  const tags = await prisma.tag.findMany()

  const { error } = await supabase.from('Tag').insert(
    tags.map(t => ({
      id: t.id,
      user_id: t.userId,
      name: t.name,
      color: t.color,
      created_at: t.createdAt.toISOString()
    }))
  )

  if (error) {
    const errorMsg = `Failed to migrate tags: ${error.message}`
    console.error(`  ❌ ${errorMsg}`)
    stats.errors.push(errorMsg)
  } else {
    stats.tags = tags.length
    console.log(`✅ Migrated ${stats.tags} tags`)
  }
}

async function migrateSavedArticles() {
  console.log('\n📦 Migrating saved articles...')
  const savedArticles = await prisma.savedArticle.findMany()

  const BATCH_SIZE = 100
  for (let i = 0; i < savedArticles.length; i += BATCH_SIZE) {
    const batch = savedArticles.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from('SavedArticle').insert(
      batch.map(s => ({
        id: s.id,
        user_id: s.userId,
        article_id: s.articleId,
        saved_at: s.savedAt.toISOString(),
        note: s.note
      }))
    )

    if (error) {
      const errorMsg = `Failed to migrate saved articles batch at ${i}: ${error.message}`
      console.error(`  ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)
    } else {
      stats.savedArticles += batch.length
      console.log(`  → Migrated ${stats.savedArticles}/${savedArticles.length} saved articles...`)
    }
  }

  console.log(`✅ Migrated ${stats.savedArticles} saved articles`)
}

async function migrateFeedTags() {
  console.log('\n📦 Migrating feed tags...')
  const feedTags = await prisma.feedTag.findMany()

  const BATCH_SIZE = 100
  for (let i = 0; i < feedTags.length; i += BATCH_SIZE) {
    const batch = feedTags.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from('FeedTag').insert(
      batch.map(ft => ({
        feed_id: ft.feedId,
        tag_id: ft.tagId,
        tagged_at: ft.taggedAt.toISOString()
      }))
    )

    if (error) {
      const errorMsg = `Failed to migrate feed tags batch at ${i}: ${error.message}`
      console.error(`  ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)
    } else {
      stats.feedTags += batch.length
      console.log(`  → Migrated ${stats.feedTags}/${feedTags.length} feed tags...`)
    }
  }

  console.log(`✅ Migrated ${stats.feedTags} feed tags`)
}

async function migrateSavedArticleTags() {
  console.log('\n📦 Migrating saved article tags...')
  const savedArticleTags = await prisma.savedArticleTag.findMany()

  const BATCH_SIZE = 100
  for (let i = 0; i < savedArticleTags.length; i += BATCH_SIZE) {
    const batch = savedArticleTags.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from('SavedArticleTag').insert(
      batch.map(sat => ({
        saved_article_id: sat.savedArticleId,
        tag_id: sat.tagId,
        tagged_at: sat.taggedAt.toISOString()
      }))
    )

    if (error) {
      const errorMsg = `Failed to migrate saved article tags batch at ${i}: ${error.message}`
      console.error(`  ❌ ${errorMsg}`)
      stats.errors.push(errorMsg)
    } else {
      stats.savedArticleTags += batch.length
      console.log(`  → Migrated ${stats.savedArticleTags}/${savedArticleTags.length} saved article tags...`)
    }
  }

  console.log(`✅ Migrated ${stats.savedArticleTags} saved article tags`)
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...')

  // Count records in Supabase
  const [
    { count: userCount },
    { count: feedCount },
    { count: articleCount },
    { count: tagCount },
    { count: savedArticleCount },
    { count: feedTagCount },
    { count: savedArticleTagCount }
  ] = await Promise.all([
    supabase.from('User').select('*', { count: 'exact', head: true }),
    supabase.from('Feed').select('*', { count: 'exact', head: true }),
    supabase.from('Article').select('*', { count: 'exact', head: true }),
    supabase.from('Tag').select('*', { count: 'exact', head: true }),
    supabase.from('SavedArticle').select('*', { count: 'exact', head: true }),
    supabase.from('FeedTag').select('*', { count: 'exact', head: true }),
    supabase.from('SavedArticleTag').select('*', { count: 'exact', head: true })
  ])

  console.log('\nMigration Summary:')
  console.log('═'.repeat(50))
  console.log(`Users:              ${stats.users} migrated, ${userCount || 0} in Supabase`)
  console.log(`Feeds:              ${stats.feeds} migrated, ${feedCount || 0} in Supabase`)
  console.log(`Articles:           ${stats.articles} migrated, ${articleCount || 0} in Supabase`)
  console.log(`Tags:               ${stats.tags} migrated, ${tagCount || 0} in Supabase`)
  console.log(`Saved Articles:     ${stats.savedArticles} migrated, ${savedArticleCount || 0} in Supabase`)
  console.log(`Feed Tags:          ${stats.feedTags} migrated, ${feedTagCount || 0} in Supabase`)
  console.log(`Saved Article Tags: ${stats.savedArticleTags} migrated, ${savedArticleTagCount || 0} in Supabase`)
  console.log('═'.repeat(50))

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  ${stats.errors.length} errors occurred during migration:`)
    stats.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`)
    })
  }

  // Verify counts match (within reason - some might fail)
  const allMatch =
    stats.users === (userCount || 0) &&
    stats.feeds === (feedCount || 0) &&
    stats.articles === (articleCount || 0) &&
    stats.tags === (tagCount || 0) &&
    stats.savedArticles === (savedArticleCount || 0) &&
    stats.feedTags === (feedTagCount || 0) &&
    stats.savedArticleTags === (savedArticleTagCount || 0)

  if (allMatch) {
    console.log('\n✅ Migration completed successfully! All counts match.')
  } else {
    console.log('\n⚠️  Migration completed with warnings. Some counts do not match.')
    console.log('   Please review the errors above and verify data manually.')
  }
}

async function main() {
  console.log('🚀 Starting migration from Prisma to Supabase...')
  console.log(`   Source: ${process.env.DATABASE_URL?.split('@')[1] || 'Prisma database'}`)
  console.log(`   Target: ${SUPABASE_URL}`)

  const startTime = Date.now()

  try {
    // Run migrations in order (respecting foreign key dependencies)
    await migrateUsers()
    await migrateFeeds()
    await migrateTags()
    await migrateArticles()
    await migrateSavedArticles()
    await migrateFeedTags()
    await migrateSavedArticleTags()

    // Verify the migration
    await verifyMigration()

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`\n⏱️  Migration completed in ${duration} seconds`)

    console.log('\n📝 Next steps:')
    console.log('   1. Review the migration summary above')
    console.log('   2. Test authentication with Google OAuth')
    console.log('   3. Test a few core features (add feed, save article)')
    console.log('   4. Test MCP integration with Claude Desktop')
    console.log('   5. If everything works, update your app to use Supabase')
    console.log('   6. Keep the Prisma database as backup for 30 days')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
