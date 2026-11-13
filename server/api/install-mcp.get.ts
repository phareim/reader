import { defineEventHandler, setResponseHeader } from 'h3'
import { setupMcpScript } from '~/server/utils/setupMcpScript'

/**
 * GET /api/install-mcp
 * Serves the MCP setup script for curl pipe to bash. Public on purpose: the
 * script holds no secret (the user passes their own token) and curl carries
 * no session cookie.
 * Usage (from your Reader clone): curl -s https://reader.phareim.no/api/install-mcp | bash -s -- --token YOUR_TOKEN
 */
export default defineEventHandler((event) => {
  // Plain text (for piping to bash)
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return setupMcpScript
})
