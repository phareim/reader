import { getRandomUnsplashImage } from '~/server/utils/unsplash'

export default defineEventHandler(async (event) => {
  try {
    const imageUrl = await getRandomUnsplashImage()

    return {
      imageUrl
    }
  } catch (error: any) {
    console.error('Error fetching Unsplash image:', error)
    return {
      imageUrl: null
    }
  }
})
