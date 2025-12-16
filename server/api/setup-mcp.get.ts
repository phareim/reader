import { defineEventHandler } from 'h3'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * GET /api/setup-mcp
 * Serves the MCP setup script for download
 */
export default defineEventHandler(async (event) => {
  const scriptPath = join(process.cwd(), 'setup-mcp.sh')

  try {
    const scriptContent = await readFile(scriptPath, 'utf-8')

    // Set headers for shell script download
    event.node.res.setHeader('Content-Type', 'text/x-shellscript')
    event.node.res.setHeader('Content-Disposition', 'attachment; filename="setup-mcp.sh"')

    return scriptContent
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load setup script'
    })
  }
})
