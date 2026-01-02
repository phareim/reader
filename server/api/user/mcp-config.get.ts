import { defineEventHandler, getQuery } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { platform, homedir } from 'os'
import { join } from 'path'

/**
 * GET /api/user/mcp-config?repoPath=/path/to/repo
 * Get MCP token status and generate Claude Desktop config
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)
  const query = getQuery(event)
  let repoPath = query.repoPath as string | undefined

  // Get current user with token
  const { data: userData, error } = await supabase
    .from('User')
    .select('mcp_token, mcp_token_created_at')
    .eq('id', user.id)
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }

  // Get the public app URL from runtime config
  const config = useRuntimeConfig()
  const appUrl = config.public.supabaseUrl?.replace('/rest/v1', '') || 'http://localhost:3000'

  // Auto-detect repository path if not provided
  if (!repoPath) {
    repoPath = process.cwd()
  }

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
