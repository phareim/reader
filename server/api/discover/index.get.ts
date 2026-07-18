import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * The /discover page's list: every ready candidate, ranked by recommender
 * count — subscription blogrolls and labeled sources (HN front page, SFL
 * saves, …) count alike. json_group_array (not GROUP_CONCAT) for the
 * via-titles — feed titles can contain any separator.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const result = await db.prepare(
    `
    SELECT
      c.id,
      c.title,
      c.site_url,
      c.site_host,
      c.feed_url,
      c.description,
      c.newest_article_at,
      COUNT(e.id) AS via_count,
      json_group_array(COALESCE(f.title, e.label, e.source)) AS via_titles
    FROM "DiscoverCandidate" c
    JOIN "DiscoverEdge" e ON e.candidate_id = c.id
    LEFT JOIN "Feed" f ON f.id = e.feed_id
    WHERE c.user_id = ? AND c.status = 'candidate'
    GROUP BY c.id
    ORDER BY via_count DESC, c.newest_article_at DESC
    `
  ).bind(user.id).all()

  const candidates = (result.results || []).map((row: any) => ({
    id: row.id as number,
    title: (row.title as string | null) || row.site_host,
    siteUrl: row.site_url as string | null,
    siteHost: row.site_host as string,
    feedUrl: row.feed_url as string,
    description: row.description as string | null,
    newestArticleAt: row.newest_article_at as string | null,
    viaCount: row.via_count as number,
    viaTitles: JSON.parse(row.via_titles || '[]') as string[],
  }))

  return { candidates }
})
