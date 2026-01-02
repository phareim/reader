/**
 * GET /api/saved-articles/counts
 * Get saved article counts by tag (efficient server-side aggregation)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  try {
    const supabase = getSupabaseClient(event)

    // Get total count, tag counts, and untagged count in parallel
    const [totalCountResult, tagCountsResult, untaggedCountResult] = await Promise.all([
      // Total saved articles
      supabase
        .from('SavedArticle')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Count by tag using database function
      supabase.rpc('get_saved_article_counts_by_tag', { p_user_id: user.id }),

      // Untagged saved articles - fetch all and filter client-side
      // (Supabase doesn't have a direct way to count by "no relationships")
      supabase
        .from('SavedArticle')
        .select(`
          id,
          tags:SavedArticleTag(tag_id)
        `)
        .eq('user_id', user.id)
    ])

    if (totalCountResult.error) {
      throw totalCountResult.error
    }

    if (tagCountsResult.error) {
      throw tagCountsResult.error
    }

    if (untaggedCountResult.error) {
      throw untaggedCountResult.error
    }

    // Count untagged articles (those with no SavedArticleTag relationships)
    const untaggedCount = (untaggedCountResult.data || []).filter(
      sa => sa.tags.length === 0
    ).length

    // Build response
    const byTag: Record<string, { tag: string; count: number }> = {}

    for (const row of tagCountsResult.data || []) {
      byTag[row.name] = {
        tag: row.name,
        count: Number(row.count)
      }
    }

    // Add inbox for untagged
    if (untaggedCount > 0) {
      byTag['__inbox__'] = { tag: '__inbox__', count: untaggedCount }
    }

    return {
      total: totalCountResult.count || 0,
      byTag,
      tags: Object.keys(byTag).filter(t => t !== '__inbox__').sort()
    }
  } catch (error: any) {
    console.error('Failed to fetch saved article counts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch saved article counts',
      message: error.message
    })
  }
})
