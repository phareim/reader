import { config } from 'dotenv'
import prisma from '../server/utils/db'
import { getRandomUnsplashImage } from '../server/utils/unsplash'

// Load environment variables from .env file
config()

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

    let updatedFromContentCount = 0
    let updatedFromUnsplashCount = 0
    let failedCount = 0

    for (const article of articlesWithoutImages) {
      let imageUrl = extractImageUrlFromContent(article.content!)

      if (imageUrl) {
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl }
        })

        updatedFromContentCount++
        console.log(`✅ Updated article ${article.id} from content: "${article.title.substring(0, 60)}..." (${article.feed.title})`)
      } else {
        // Fallback to Unsplash if no image found in content
        const unsplashImage = await getRandomUnsplashImage()
        if (unsplashImage) {
          await prisma.article.update({
            where: { id: article.id },
            data: { imageUrl: unsplashImage }
          })

          updatedFromUnsplashCount++
          console.log(`🌄 Updated article ${article.id} from Unsplash: "${article.title.substring(0, 60)}..." (${article.feed.title})`)
        } else {
          failedCount++
          console.log(`❌ Failed to get image for article ${article.id}: "${article.title.substring(0, 60)}..." (${article.feed.title})`)
        }
      }

      // Small delay to avoid rate limiting on Unsplash API
      if (!imageUrl) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('\n✨ Backfill complete!')
    console.log(`📊 Statistics:`)
    console.log(`   - Total articles processed: ${articlesWithoutImages.length}`)
    console.log(`   - Images from content: ${updatedFromContentCount}`)
    console.log(`   - Images from Unsplash: ${updatedFromUnsplashCount}`)
    console.log(`   - Failed: ${failedCount}`)

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
