import { getArticleBucket } from '~/server/utils/cloudflare'

const ARTICLE_PREFIX = 'articles'
const NOTE_PREFIX = 'notes'

export const buildArticleContentKey = (articleId: number) => {
  return `${ARTICLE_PREFIX}/${articleId}.html`
}

export const storeArticleContent = async (event: any, articleId: number, content: string) => {
  const bucket = getArticleBucket(event)
  const key = buildArticleContentKey(articleId)
  await bucket.put(key, content, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8'
    }
  })
  return key
}

export const fetchArticleContent = async (event: any, key?: string | null) => {
  if (!key) return null
  const bucket = getArticleBucket(event)
  const object = await bucket.get(key)
  if (!object) return null
  return await object.text()
}

export const deleteArticleContent = async (event: any, key?: string | null) => {
  if (!key) return
  const bucket = getArticleBucket(event)
  await bucket.delete(key)
}

/**
 * Delete many stored objects (article bodies, notes) in as few R2 calls as
 * possible: R2 takes up to 1000 keys per delete, and every call is one of
 * the Worker invocation's 1000 subrequests.
 */
export const deleteStoredObjects = async (event: any, keys: Array<string | null | undefined>) => {
  const present = keys.filter((key): key is string => !!key)
  if (!present.length) return
  const bucket = getArticleBucket(event)
  const BATCH = 1000
  for (let i = 0; i < present.length; i += BATCH) {
    await bucket.delete(present.slice(i, i + BATCH))
  }
}

export const buildNoteKey = (savedArticleId: number) => {
  return `${NOTE_PREFIX}/${savedArticleId}.txt`
}

export const storeSavedArticleNote = async (event: any, savedArticleId: number, note: string) => {
  const bucket = getArticleBucket(event)
  const key = buildNoteKey(savedArticleId)
  await bucket.put(key, note, {
    httpMetadata: {
      contentType: 'text/plain; charset=utf-8'
    }
  })
  return key
}

export const fetchSavedArticleNote = async (event: any, key?: string | null) => {
  if (!key) return null
  const bucket = getArticleBucket(event)
  const object = await bucket.get(key)
  if (!object) return null
  return await object.text()
}

export const deleteSavedArticleNote = async (event: any, key?: string | null) => {
  if (!key) return
  const bucket = getArticleBucket(event)
  await bucket.delete(key)
}
