import { defineEventHandler, getQuery, getRequestURL } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { platform, homedir } from 'os'
import { join } from 'path'

/**
 * GET /api/user/mcp-config?repoPath=/path/to/repo
 * Get MCP token status and generate Claude Desktop config
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)
  const query = getQuery(event)
  const repoPath = query.repoPath as string | undefined

  // Get current user with token
  const userData = await db.prepare(
    `
    SELECT mcp_token, mcp_token_created_at
    FROM "User"
    WHERE id = ?
    `
  ).bind(user.id).first()

  // The app's own origin, from the request (there is no runtimeConfig for
  // it: the old `config.public.authOrigin` was never defined, so every
  // command on /mcp-settings pointed at http://localhost:3000). On the
  // Worker the scheme can come through as http:, and Reader is only served
  // over https, so a non-local http origin is lifted to https.
  const url = getRequestURL(event)
  if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(url.hostname)) {
    url.protocol = 'https:'
  }
  const appUrl = url.origin

  // The repository lives on the user's machine; the Worker cannot see it
  // (process.cwd() is "/" there), so only use a path the caller passes.
  // Detect Claude Desktop config path based on platform
  const os = platform()
  let claudeConfigPath = ''
  if (os === 'darwin') {
    claudeConfigPath = join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json')
  } else if (os === 'win32') {
    claudeConfigPath = join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json')
  } else if (os === 'linux') {
    claudeConfigPath = join(homedir(), '.config/Claude/claude_desktop_config.json')
  }

  // Generate config if token exists and repo path provided
  let mcpConfig = null
  if (userData?.mcp_token && repoPath) {
    mcpConfig = {
      mcpServers: {
        'the-librarian': {
          command: 'node',
          args: [
            `${repoPath}/node_modules/.bin/tsx`,
            `${repoPath}/mcp-server/index.ts`
          ],
          env: {
            READER_API_URL: appUrl,
            MCP_TOKEN: userData.mcp_token
          }
        }
      }
    }
  }

  return {
    hasToken: !!userData?.mcp_token,
    tokenCreatedAt: userData?.mcp_token_created_at,
    appUrl,
    repoPath,
    claudeConfigPath,
    platform: os,
    config: mcpConfig
  }
})
