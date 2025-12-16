import { defineEventHandler } from 'h3'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * GET /api/install-mcp
 * Serves the MCP setup script for curl pipe to bash
 * Usage: curl -s https://reader.phareim.no/api/install-mcp | bash -s -- --token YOUR_TOKEN
 */
export default defineEventHandler(async (event) => {
  const scriptPath = join(process.cwd(), 'setup-mcp.sh')

  try {
    const scriptContent = await readFile(scriptPath, 'utf-8')

    // Set headers for plain text (for piping to bash)
    event.node.res.setHeader('Content-Type', 'text/plain')
    event.node.res.setHeader('Cache-Control', 'no-cache')

    return scriptContent
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load setup script'
    })
  }
})
