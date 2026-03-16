import { toWebRequest } from 'h3'
import { getAuth } from '~/server/utils/better-auth'

export default defineEventHandler((event) => {
  const auth = getAuth(event)
  return auth.handler(toWebRequest(event))
})
