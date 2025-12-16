import { defineEventHandler } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'

/**
 * GET /api/mcp/test
 * Test MCP connection - verifies authentication works
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await getAuthenticatedUser(event)

    return {
      success: true,
      message: 'MCP connection successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Authentication failed'
    }
  }
})
