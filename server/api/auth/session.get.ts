import { getSessionUser } from '~/server/utils/session'
import { toPublicUser } from '~/server/utils/auth'
import { isPersonalUser } from '~/server/utils/personal'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  if (!user) {
    return { user: null }
  }

  // `personal` drives which verbs the UI offers: SFL elevate, the
  // highlight→SFL mirror, and read-aloud are allowlisted (they run on
  // Petter's external accounts); everything else is for every user.
  return { user: toPublicUser(user), features: { personal: isPersonalUser(event, user) } }
})
