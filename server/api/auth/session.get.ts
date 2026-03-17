import { getSessionUser } from '~/server/utils/session'
import { toPublicUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  if (!user) {
    return { user: null }
  }

  return { user: toPublicUser(user) }
})
