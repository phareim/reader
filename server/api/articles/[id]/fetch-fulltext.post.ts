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
    `SELECT a.id, a.url, a.full_text_status
     FROM "Article" a
     JOIN "Feed" f ON f.id = a.feed_id
     WHERE a.id = ? AND f.user_id = ?`
  ).bind(articleId, user.id).first()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const result = await fetchFullText(event, { id: article.id, url: article.url })

  if (result.status !== 'fetched') {
    await updateFullTextStatus(event, articleId, result.status, result.error)
  }

  return {
    status: result.status,
    error: result.error
  }
})
