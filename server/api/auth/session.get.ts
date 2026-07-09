import { getSessionUser } from '~/server/utils/session'
import { toPublicUser } from '~/server/utils/auth'
import { isPersonalUser } from '~/server/utils/personal'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  if (!user) {
    return { user: null }
  }

  // `personal` drives which verbs the UI offers: SFL elevate and the
  // highlight→SFL mirror are allowlisted (they write into Petter's
  // knowledge pipeline); everything else is for every user.
  return { user: toPublicUser(user), features: { personal: isPersonalUser(event, user) } }
})
