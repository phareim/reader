import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { fetchFullText, updateFullTextStatus } from '~/server/utils/fulltext'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const articleId = Number(event.context.params?.id)

  if (Number.isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const db = getD1(event)

  const article = await db.prepare(
    `SELECT a.id, a.url, a.full_text_status, a.content_key, f.kind AS feed_kind
     FROM "Article" a
     JOIN "Feed" f ON f.id = a.feed_id
     WHERE a.id = ? AND f.user_id = ?`
  ).bind(articleId, user.id).first()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  // Found items are pushed fully rendered by a collector — the stored body IS
  // the article (an X post, a digest, …). Fetching the source URL would only
  // scrape a JS shell and clobber it.
  if (article.feed_kind === 'found') {
    await updateFullTextStatus(event, articleId, 'skipped', 'Found items are complete as delivered')
    return { status: 'skipped', imageUrl: null, error: 'Found items are complete as delivered' }
  }

  const result = await fetchFullText(event, {
    id: article.id,
    url: article.url,
    contentKey: article.content_key
  })

  if (result.status !== 'fetched') {
    await updateFullTextStatus(event, articleId, result.status, result.error)
  }

  return {
    status: result.status,
    imageUrl: result.imageUrl ?? null,
    error: result.error
  }
})
