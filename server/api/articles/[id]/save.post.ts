import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  // Get article ID from route params
  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    const supabase = getSupabaseClient(event)

    // Verify article exists and belongs to user's feed, and fetch feed tags
    const { data: article, error: articleError } = await supabase
      .from('Article')
      .select(`
        id,
        feed:Feed!inner(
          user_id,
          tags:FeedTag(
            tag:Tag(name)
          )
        )
      `)
      .eq('id', articleId)
      .eq('Feed.user_id', user.id)
      .single()

    if (articleError || !article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Get feed tag names
    const feedTags = article.feed.tags.map(ft => ft.tag.name)

    // Call database function to save with tag inheritance
    const { data, error } = await supabase
      .rpc('save_article_with_tags', {
        p_user_id: user.id,
        p_article_id: articleId,
        p_feed_tags: feedTags
      })

    if (error) {
      throw createError({
        statusCode: 500,
        message: error.message
      })
    }

    return {
      success: true,
      savedArticle: {
        id: data[0].saved_article_id,
        articleId: articleId,
        savedAt: data[0].saved_at
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save article',
      message: error.message
    })
  }
})
