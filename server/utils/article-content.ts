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
