import { getSessionUser } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  if (!user) {
    return { user: null }
  }

  return {
    user: {
      id: (user as any).id,
      email: (user as any).email,
      name: (user as any).name,
      image: (user as any).image,
    }
  }
})
