/**
 * Migration script to convert feed tags from JSON strings to relational Tag model
 *
 * This script:
 * 1. Reads all feeds with their JSON tag arrays
 * 2. Creates Tag records for unique tag names per user
 * 3. Creates FeedTag junction records to link feeds to tags
 * 4. Preserves the old tags column for rollback safety
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateTags() {
  console.log('Starting tag migration...\n')

  try {
    // Get all feeds with tags
    const feeds = await prisma.$queryRaw<Array<{
      id: number
      userId: string
      title: string
      tags: string
    }>>`SELECT id, "userId", title, tags FROM "Feed"`

    console.log(`Found ${feeds.length} feeds to process\n`)

    let totalTagsCreated = 0
    let totalFeedTagsCreated = 0
    const userTagCache = new Map<string, Map<string, number>>() // userId -> (tagName -> tagId)

    for (const feed of feeds) {
      try {
        // Parse the JSON tags array
        let tagNames: string[] = []
        try {
          tagNames = JSON.parse(feed.tags)
        } catch (e) {
          console.log(`⚠️  Feed ${feed.id} (${feed.title}): Invalid JSON in tags field, skipping`)
          continue
        }

        if (!Array.isArray(tagNames) || tagNames.length === 0) {
          continue
        }

        console.log(`Processing feed ${feed.id} (${feed.title}): ${tagNames.join(', ')}`)

        // Get or create user's tag cache
        if (!userTagCache.has(feed.userId)) {
          userTagCache.set(feed.userId, new Map())
        }
        const tagCache = userTagCache.get(feed.userId)!

        // Process each tag
        for (const tagName of tagNames) {
          if (!tagName || typeof tagName !== 'string') {
            console.log(`  ⚠️  Skipping invalid tag: ${tagName}`)
            continue
          }

          const trimmedTag = tagName.trim()
          if (!trimmedTag) {
            continue
          }

          let tagId: number

          // Check cache first
          if (tagCache.has(trimmedTag)) {
            tagId = tagCache.get(trimmedTag)!
          } else {
            // Find or create tag
            const existingTag = await prisma.tag.findUnique({
              where: {
                userId_name: {
                  userId: feed.userId,
                  name: trimmedTag
                }
              }
            })

            if (existingTag) {
              tagId = existingTag.id
              console.log(`  ✓ Found existing tag: "${trimmedTag}" (id: ${tagId})`)
            } else {
              const newTag = await prisma.tag.create({
                data: {
                  userId: feed.userId,
                  name: trimmedTag
                }
              })
              tagId = newTag.id
              totalTagsCreated++
              console.log(`  ✓ Created new tag: "${trimmedTag}" (id: ${tagId})`)
            }

            // Cache the tag ID
            tagCache.set(trimmedTag, tagId)
          }

          // Create FeedTag junction record (using upsert to avoid duplicates)
          await prisma.feedTag.upsert({
            where: {
              feedId_tagId: {
                feedId: feed.id,
                tagId: tagId
              }
            },
            create: {
              feedId: feed.id,
              tagId: tagId
            },
            update: {}
          })
          totalFeedTagsCreated++
          console.log(`  ✓ Linked feed to tag "${trimmedTag}"`)
        }

        console.log(`✓ Completed feed ${feed.id}\n`)
      } catch (error) {
        console.error(`❌ Error processing feed ${feed.id}:`, error)
        // Continue with next feed
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total feeds processed: ${feeds.length}`)
    console.log(`Total tags created: ${totalTagsCreated}`)
    console.log(`Total feed-tag links created: ${totalFeedTagsCreated}`)
    console.log('\n✅ Migration completed successfully!')
    console.log('\nNote: Old "tags" column in Feed table is preserved for rollback.')
    console.log('You can manually remove it after verifying the migration.')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateTags()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
