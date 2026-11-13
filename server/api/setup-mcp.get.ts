import { defineEventHandler, setResponseHeader } from 'h3'
import { setupMcpScript } from '~/server/utils/setupMcpScript'

/**
 * GET /api/setup-mcp
 * Serves the MCP setup script for download. Public, like /api/install-mcp:
 * the script holds no secret.
 */
export default defineEventHandler((event) => {
  // Shell script download
  setResponseHeader(event, 'Content-Type', 'text/x-shellscript')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="setup-mcp.sh"')
  return setupMcpScript
})
