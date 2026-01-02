import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { parseFeed } from '~/server/utils/feedParser'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    // Verify feed exists and belongs to user
    const { data: feed, error: feedQueryError } = await supabase
      .from('Feed')
      .select('url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (feedQueryError || !feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    const parsedFeed = await parseFeed(feed.url)

    // Update feed metadata
    const { error: updateError } = await supabase
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
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    // Insert articles in batch, ignoring duplicates
    const articlesData = articlesToAdd.map(item => ({
      feed_id: id,
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

    const newArticles = insertedArticles?.length || 0

    // Ignore duplicate errors
    if (articlesError && !articlesError.message.includes('duplicate')) {
      console.error('Error inserting articles:', articlesError)
    }

    return {
      success: true,
      newArticles
    }
  } catch (error: any) {
    // On error, increment error count and deactivate after 10 errors
    try {
      const { data: current } = await supabase
        .from('Feed')
        .select('error_count')
        .eq('id', id)
        .eq('user_id', user.id)
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
          .eq('id', id)
          .eq('user_id', user.id)
      }
    } catch (updateError) {
      // Ignore errors during error tracking update
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh feed',
      message: error.message
    })
  }
})
