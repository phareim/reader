import { createError } from 'h3'

type CloudflareEnv = {
  DB?: any
  ARTICLE_BUCKET?: any
}

const getEnv = (event: any): CloudflareEnv => {
  const env = event?.context?.cloudflare?.env as CloudflareEnv | undefined
  if (!env) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Cloudflare bindings are not available in this runtime.'
    })
  }
  return env
}

export const getD1 = (event: any) => {
  const env = getEnv(event)
  if (!env.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 database binding (DB) is not configured.'
    })
  }
  return env.DB
}

export const getArticleBucket = (event: any) => {
  const env = getEnv(event)
  if (!env.ARTICLE_BUCKET) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 bucket binding (ARTICLE_BUCKET) is not configured.'
    })
  }
  return env.ARTICLE_BUCKET
}
