import prisma from '../server/utils/db'

/**
 * Extract image URL from article content using the same logic as feedParser
 */
function extractImageUrlFromContent(content?: string): string | undefined {
  if (!content) return undefined

  // Extract first <img> tag from HTML content
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) {
    return imgMatch[1]
  }

  return undefined
}

async function backfillArticleImages() {
  console.log('🖼️  Starting article image backfill...\n')

  try {
    // Find all articles without images but with content
    const articlesWithoutImages = await prisma.article.findMany({
      where: {
        imageUrl: null,
        content: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        content: true,
        feed: {
          select: {
            title: true
          }
        }
      }
    })

    console.log(`Found ${articlesWithoutImages.length} articles without images\n`)

    let updatedCount = 0
    let skippedCount = 0

    for (const article of articlesWithoutImages) {
      const imageUrl = extractImageUrlFromContent(article.content!)

      if (imageUrl) {
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl }
        })

        updatedCount++
        console.log(`✅ Updated article ${article.id}: "${article.title.substring(0, 60)}..." (${article.feed.title})`)
        console.log(`   Image: ${imageUrl.substring(0, 80)}...\n`)
      } else {
        skippedCount++
      }
    }

    console.log('\n✨ Backfill complete!')
    console.log(`📊 Statistics:`)
    console.log(`   - Total articles processed: ${articlesWithoutImages.length}`)
    console.log(`   - Articles with images added: ${updatedCount}`)
    console.log(`   - Articles without images: ${skippedCount}`)

  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
backfillArticleImages()
  .then(() => {
    console.log('\n🎉 Script finished successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
