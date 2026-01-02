/**
 * POST /api/articles/manual
 * Add a manual article (not from RSS feed) and save it
 * This allows Claude to add articles it finds interesting
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { z } from 'zod'

const manualArticleSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  content: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const validation = manualArticleSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { title, url, content, summary, author, tags } = validation.data

  try {
    const supabase = getSupabaseClient(event)

    // Use database function to handle the entire flow
    const { data, error } = await supabase
      .rpc('add_manual_article', {
        p_user_id: user.id,
        p_title: title,
        p_url: url,
        p_summary: summary || null,
        p_author: author || null,
        p_tag_names: tags || []
      })

    if (error) {
      throw error
    }

    // Get the article details for the response
    const { data: article, error: articleError } = await supabase
      .from('Article')
      .select('id, title, url')
      .eq('id', data[0].article_id)
      .single()

    if (articleError) {
      throw articleError
    }

    // Get the saved article timestamp
    const { data: savedArticle, error: savedError } = await supabase
      .from('SavedArticle')
      .select('saved_at')
      .eq('id', data[0].saved_article_id)
      .single()

    if (savedError) {
      throw savedError
    }

    return {
      success: true,
      article: {
        id: article.id,
        title: article.title,
        url: article.url,
        savedAt: savedArticle.saved_at
      },
      tags: tags || []
    }
  } catch (error: any) {
    console.error('Error adding manual article:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add manual article',
      message: error.message
    })
  }
})
