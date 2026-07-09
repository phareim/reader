/**
 * Read-aloud synthesis proxy. The gRPC Riva client can't run on the Worker,
 * so the `reader-tts` service on Sleeper does the NVIDIA Magpie call and this
 * route just fronts it with Reader auth (session or MCP token) and the shared
 * bearer secret. Mirrors the SFL pattern: 503 when unconfigured, fail soft.
 */

const MAX_CHARS = 3000

export default defineEventHandler(async (event) => {
  await getAuthenticatedUser(event)

  const config = useRuntimeConfig(event)
  if (!config.ttsApiUrl || !config.ttsApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Read-aloud is not configured' })
  }

  const body = await readBody(event).catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'text is required' })
  }
  if (text.length > MAX_CHARS) {
    throw createError({ statusCode: 413, statusMessage: `text exceeds ${MAX_CHARS} chars` })
  }

  let res: Response
  try {
    res = await fetch(`${config.ttsApiUrl}/synthesize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ttsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      // Synthesis of a full chunk runs a few seconds; leave generous headroom.
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw createError({ statusCode: 504, statusMessage: 'TTS timed out' })
    }
    throw createError({ statusCode: 502, statusMessage: 'TTS network error' })
  }
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `TTS failed (${res.status})` })
  }

  // Pass the upstream type through: Magpie chunks come back audio/wav,
  // Norwegian chunks (OpenAI-routed on the Sleeper side) audio/mpeg.
  setHeader(event, 'Content-Type', res.headers.get('content-type') || 'audio/wav')
  setHeader(event, 'Cache-Control', 'no-store')
  return new Uint8Array(await res.arrayBuffer())
})
