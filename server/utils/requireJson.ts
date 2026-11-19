import type { H3Event } from 'h3'

/**
 * A cross-site HTML form can POST urlencoded or multipart bodies without a
 * preflight, which made login CSRF possible (the victim signed in to the
 * attacker's account). application/json needs a CORS preflight, so requiring
 * it on the auth POSTs closes that. auth-web's relay already sends JSON.
 */
export function requireJson(event: H3Event): void {
  const type = (getRequestHeader(event, 'content-type') || '').toLowerCase()
  if (!type.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Expected application/json' })
  }
}
