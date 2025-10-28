/**
 * Fetch a random image from Unsplash API
 */
export async function getRandomUnsplashImage(): Promise<string | null> {
  const clientId = process.env.UNSPLASH_CLIENT_ID

  if (!clientId) {
    console.warn('UNSPLASH_CLIENT_ID not configured, skipping fallback image')
    return null
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?client_id=${clientId}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('Unsplash API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json()

    // Use the small size URL as requested (400px wide)
    return data.urls?.small || null
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error)
    return null
  }
}
