import { defineEventHandler, getQuery } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

/**
 * GET /api/user/mcp-config?repoPath=/path/to/repo
 * Get MCP token status and generate Claude Desktop config
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const query = getQuery(event)
  const repoPath = query.repoPath as string | undefined

  // Get current user with token
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      mcpToken: true,
      mcpTokenCreatedAt: true
    }
  })

  // Get the public app URL from AUTH_ORIGIN
  const appUrl = process.env.AUTH_ORIGIN || 'http://localhost:3000'

  // Generate config if token exists and repo path provided
  let config = null
  if (userData?.mcpToken && repoPath) {
    config = {
      mcpServers: {
        'the-librarian': {
          command: 'node',
          args: [
            `${repoPath}/node_modules/.bin/tsx`,
            `${repoPath}/mcp-server/index.ts`
          ],
          env: {
            READER_API_URL: appUrl,
            MCP_TOKEN: userData.mcpToken
          }
        }
      }
    }
  }

  return {
    hasToken: !!userData?.mcpToken,
    tokenCreatedAt: userData?.mcpTokenCreatedAt,
    appUrl,
    config
  }
})
