import { buildBridgeXml, BRIDGE_SECTIONS, type BridgeSection } from '~/server/utils/anthropicBridge'

/**
 * RSS bridge for the Anthropic properties that publish no feed of their own.
 * Public (feed sync fetches without cookies; the upstream data is public).
 * Note feed sync does NOT hit this route — a Worker cannot fetch its own
 * hostname, so parseFeed() recognizes bridge URLs and calls buildBridgeXml()
 * directly. This route serves external consumers (and hand-testing).
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!(section in BRIDGE_SECTIONS)) {
    throw createError({ statusCode: 404, statusMessage: `Unknown bridge section: ${section}` })
  }

  let xml: string
  try {
    xml = await buildBridgeXml(section as BridgeSection)
  } catch (error: any) {
    throw createError({ statusCode: 502, statusMessage: error?.message ?? 'Bridge failed' })
  }

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=1800')
  return xml
})
