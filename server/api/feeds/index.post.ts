import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { parseFeed } from '~/server/utils/feedParser'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: 'Feed URL is required'
    })
  }

  try {
    // Check if user already has this feed
    const { data: existingFeed } = await supabase
      .from('Feed')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', url)
      .single()

    if (existingFeed) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Feed already exists',
        message: 'This feed is already in your subscription list'
      })
    }

    // Parse the feed
    const parsedFeed = await parseFeed(url)

    // Create feed in database
    const { data: feed, error: feedError } = await supabase
      .from('Feed')
      .insert({
        user_id: user.id,
        url,
        title: parsedFeed.title,
        description: parsedFeed.description,
        site_url: parsedFeed.siteUrl,
        favicon_url: parsedFeed.faviconUrl,
        last_fetched_at: new Date().toISOString()
      })
      .select()
      .single()

    if (feedError) {
      throw createError({
        statusCode: 500,
        message: feedError.message
      })
    }

    // Add articles (limit to MAX_ARTICLES_PER_FEED)
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

    // Use insert with onConflict to handle duplicates
    const { data: insertedArticles, error: articlesError } = await supabase
      .from('Article')
      .insert(articlesData)
      .select('id')

    // Count inserted articles (ignoring duplicates)
    const articlesAdded = insertedArticles?.length || 0

    // If there's an error other than duplicate key constraint, throw it
    if (articlesError && !articlesError.message.includes('duplicate')) {
      console.error('Error inserting articles:', articlesError)
    }

    return {
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.site_url,
        faviconUrl: feed.favicon_url
      },
      articlesAdded
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add feed',
      message: error.message
    })
  }
})
