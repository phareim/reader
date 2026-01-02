import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { parseFeed } from '~/server/utils/feedParser'
import type { SupabaseClient } from '@supabase/supabase-js'

interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

interface FeedToSync {
  id: number
  url: string
  title: string
  user_id: string
}

async function syncFeed(feed: FeedToSync, supabase: SupabaseClient): Promise<SyncResult> {
  try {
    const parsedFeed = await parseFeed(feed.url)

    // Update feed metadata
    await supabase
      .from('Feed')
      .update({
        title: parsedFeed.title,
        description: parsedFeed.description,
        site_url: parsedFeed.siteUrl,
        favicon_url: parsedFeed.faviconUrl,
        last_fetched_at: new Date().toISOString(),
        last_error: null,
        error_count: 0
      })
      .eq('id', feed.id)
      .eq('user_id', feed.user_id)

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    // Insert articles in batch, ignoring duplicates
    const articlesData = articlesToAdd.map(item => ({
      feed_id: feed.id,
      guid: item.guid,
      title: item.title,
      url: item.url,
      author: item.author,
      content: item.content,
      summary: item.summary,
      image_url: item.imageUrl,
      published_at: item.publishedAt?.toISOString()
    }))

    const { data: insertedArticles, error: articlesError } = await supabase
      .from('Article')
      .insert(articlesData)
      .select('id')

    const articlesAdded = insertedArticles?.length || 0

    // Ignore duplicate errors
    if (articlesError && !articlesError.message.includes('duplicate')) {
      console.error('Error inserting articles:', articlesError)
    }

    return {
      feedId: feed.id,
      feedTitle: feed.title,
      success: true,
      newArticles: articlesAdded
    }
  } catch (error: any) {
    // On error, increment error count and deactivate after 10 errors
    try {
      const { data: current } = await supabase
        .from('Feed')
        .select('error_count')
        .eq('id', feed.id)
        .eq('user_id', feed.user_id)
        .single()

      if (current) {
        const nextErrorCount = (current.error_count || 0) + 1

        await supabase
          .from('Feed')
          .update({
            last_error: error.message,
            error_count: nextErrorCount,
            is_active: nextErrorCount >= 10 ? false : undefined
          })
          .eq('id', feed.id)
          .eq('user_id', feed.user_id)
      }
    } catch (updateError) {
      // Ignore errors during error tracking update
    }

    return {
      feedId: feed.id,
      feedTitle: feed.title,
      success: false,
      error: error.message
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  try {
    const { data: feeds, error: feedsError } = await supabase
      .from('Feed')
      .select('id, url, title, user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (feedsError) {
      throw createError({
        statusCode: 500,
        message: feedsError.message
      })
    }

    if (feeds.length === 0) {
      return {
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 0,
          newArticles: 0
        }
      }
    }

    const concurrencyLimit = 5
    const results: SyncResult[] = []

    for (let i = 0; i < feeds.length; i += concurrencyLimit) {
      const batch = feeds.slice(i, i + concurrencyLimit)
      const batchResults = await Promise.allSettled(
        batch.map(feed => syncFeed(feed, supabase))
      )

      results.push(...batchResults.map((r, idx) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              feedId: batch[idx].id,
              feedTitle: batch[idx].title,
              success: false,
              error: 'Unexpected error during sync'
            }
      ))
    }

    const summary = {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      newArticles: results.reduce((sum, r) => sum + (r.newArticles || 0), 0)
    }

    return {
      results,
      summary
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Sync failed',
      message: error.message
    })
  }
})
