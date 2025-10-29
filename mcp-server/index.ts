CT#!/usr/bin/env node

/**
 * The Librarian MCP Server
 *
 * A Model Context Protocol server that allows Claude to interact with your RSS reader.
 * Provides tools for reading feeds, articles, and managing saved content.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js'
import type {
  FeedsResponse,
  ArticlesResponse,
  SavedArticlesResponse,
  SaveArticleResponse,
  UnsaveArticleResponse,
  TagArticleResponse,
  TagsResponse,
  AddManualArticleResponse,
  Tag
} from '../types/api.js'

// Configuration
const API_BASE_URL = process.env.READER_API_URL || 'http://localhost:3000'
const MCP_TOKEN = process.env.MCP_TOKEN || '' // MCP authentication token

/**
 * Make authenticated API request to Reader
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // Add MCP token for authentication
  if (MCP_TOKEN) {
    headers['X-MCP-Token'] = MCP_TOKEN
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${error}`)
  }

  return response.json() as Promise<T>
}

/**
 * Define MCP tools
 */
const tools: Tool[] = [
  {
    name: 'list_feeds',
    description: 'Get all subscribed RSS feeds with their titles, URLs, and unread counts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_recent_articles',
    description: 'Get recent articles from feeds. Can filter by feed ID, read status, and limit results.',
    inputSchema: {
      type: 'object',
      properties: {
        feedId: {
          type: 'number',
          description: 'Optional: Filter by specific feed ID'
        },
        isRead: {
          type: 'boolean',
          description: 'Optional: Filter by read status (true = read, false = unread)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (default: 50, max: 200)',
          default: 50
        },
        offset: {
          type: 'number',
          description: 'Number of articles to skip (for pagination)',
          default: 0
        }
      }
    }
  },
  {
    name: 'search_articles',
    description: 'Search for articles. Returns articles matching the criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        feedId: {
          type: 'number',
          description: 'Optional: Search within specific feed'
        },
        isRead: {
          type: 'boolean',
          description: 'Optional: Filter by read status'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
          default: 50
        }
      }
    }
  },
  {
    name: 'get_article',
    description: 'Get full details of a specific article by ID, including complete content',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'number',
          description: 'The ID of the article to retrieve'
        }
      },
      required: ['articleId']
    }
  },
  {
    name: 'get_saved_articles',
    description: 'Get all saved articles. Can filter by tag.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Optional: Filter by tag name. Use "__inbox__" for untagged articles.'
        }
      }
    }
  },
  {
    name: 'save_article',
    description: 'Save an article for later reading',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'number',
          description: 'The ID of the article to save'
        }
      },
      required: ['articleId']
    }
  },
  {
    name: 'unsave_article',
    description: 'Remove an article from saved articles',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'number',
          description: 'The ID of the article to unsave'
        }
      },
      required: ['articleId']
    }
  },
  {
    name: 'tag_article',
    description: 'Add or update tags for a saved article. This replaces all existing tags.',
    inputSchema: {
      type: 'object',
      properties: {
        savedArticleId: {
          type: 'number',
          description: 'The saved article ID (not the article ID - get this from get_saved_articles)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of tag names to apply to the article'
        }
      },
      required: ['savedArticleId', 'tags']
    }
  },
  {
    name: 'list_tags',
    description: 'Get all tags currently used in the Reader. Shows tag names, colors, and usage counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'add_article',
    description: 'Add a new article (not from RSS) to the Reader and save it. Use this when you find an interesting article to add to the user\'s reading list. The article will be automatically saved and can be tagged with existing tags.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The article title'
        },
        url: {
          type: 'string',
          description: 'The article URL'
        },
        summary: {
          type: 'string',
          description: 'Optional: A brief summary or description of the article'
        },
        author: {
          type: 'string',
          description: 'Optional: The article author'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Array of tag names to apply (use existing tags from list_tags)'
        }
      },
      required: ['title', 'url']
    }
  }
]

/**
 * Create and configure MCP server
 */
const server = new Server(
  {
    name: 'the-librarian',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

/**
 * Handler: List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

/**
 * Handler: Execute tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'list_feeds': {
        const data = await apiRequest<FeedsResponse>('/api/feeds')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.feeds, null, 2)
            }
          ]
        }
      }

      case 'get_recent_articles': {
        const params = new URLSearchParams()
        if (args.feedId) params.append('feedId', String(args.feedId))
        if (args.isRead !== undefined) params.append('isRead', String(args.isRead))
        if (args.limit) params.append('limit', String(args.limit))
        if (args.offset) params.append('offset', String(args.offset))

        const queryString = params.toString()
        const endpoint = `/api/articles${queryString ? `?${queryString}` : ''}`
        const data = await apiRequest<ArticlesResponse>(endpoint)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                articles: data.articles,
                total: data.total,
                hasMore: data.hasMore,
                showing: data.articles.length
              }, null, 2)
            }
          ]
        }
      }

      case 'search_articles': {
        const params = new URLSearchParams()
        if (args.feedId) params.append('feedId', String(args.feedId))
        if (args.isRead !== undefined) params.append('isRead', String(args.isRead))
        if (args.limit) params.append('limit', String(args.limit))

        const queryString = params.toString()
        const endpoint = `/api/articles${queryString ? `?${queryString}` : ''}`
        const data = await apiRequest<ArticlesResponse>(endpoint)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                articles: data.articles,
                total: data.total,
                hasMore: data.hasMore
              }, null, 2)
            }
          ]
        }
      }

      case 'get_article': {
        if (!args.articleId) {
          throw new Error('articleId is required')
        }

        // Get the article by fetching with specific ID filter
        const data = await apiRequest<ArticlesResponse>(`/api/articles?limit=1`)
        const article = data.articles.find((a: any) => a.id === args.articleId)

        if (!article) {
          throw new Error(`Article ${args.articleId} not found`)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(article, null, 2)
            }
          ]
        }
      }

      case 'get_saved_articles': {
        const params = new URLSearchParams()
        if (args.tag) params.append('tag', String(args.tag))

        const queryString = params.toString()
        const endpoint = `/api/saved-articles${queryString ? `?${queryString}` : ''}`
        const data = await apiRequest<SavedArticlesResponse>(endpoint)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.articles, null, 2)
            }
          ]
        }
      }

      case 'save_article': {
        if (!args.articleId) {
          throw new Error('articleId is required')
        }

        const data = await apiRequest<SaveArticleResponse>(
          `/api/articles/${args.articleId}/save`,
          { method: 'POST' }
        )

        return {
          content: [
            {
              type: 'text',
              text: `Article ${args.articleId} saved successfully! Saved at: ${data.savedArticle.savedAt}`
            }
          ]
        }
      }

      case 'unsave_article': {
        if (!args.articleId) {
          throw new Error('articleId is required')
        }

        await apiRequest<UnsaveArticleResponse>(
          `/api/articles/${args.articleId}/save`,
          { method: 'DELETE' }
        )

        return {
          content: [
            {
              type: 'text',
              text: `Article ${args.articleId} unsaved successfully!`
            }
          ]
        }
      }

      case 'tag_article': {
        if (!args.savedArticleId) {
          throw new Error('savedArticleId is required')
        }
        if (!args.tags || !Array.isArray(args.tags)) {
          throw new Error('tags must be an array of strings')
        }

        const data = await apiRequest<TagArticleResponse>(
          `/api/saved-articles/${args.savedArticleId}/tags`,
          {
            method: 'PATCH',
            body: JSON.stringify({ tags: args.tags })
          }
        )

        return {
          content: [
            {
              type: 'text',
              text: `Article tagged successfully with: ${data.tags.join(', ')}`
            }
          ]
        }
      }

      case 'list_tags': {
        const data = await apiRequest<Tag[]>('/api/tags')

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        }
      }

      case 'add_article': {
        if (!args.title) {
          throw new Error('title is required')
        }
        if (!args.url) {
          throw new Error('url is required')
        }

        const requestBody: any = {
          title: args.title,
          url: args.url
        }

        if (args.summary) requestBody.summary = args.summary
        if (args.author) requestBody.author = args.author
        if (args.tags && Array.isArray(args.tags)) requestBody.tags = args.tags

        const data = await apiRequest<AddManualArticleResponse>(
          '/api/articles/manual',
          {
            method: 'POST',
            body: JSON.stringify(requestBody)
          }
        )

        let response = `Article added successfully!\n\nTitle: ${data.article.title}\nURL: ${data.article.url}\nSaved at: ${data.article.savedAt}`

        if (data.tags && data.tags.length > 0) {
          response += `\nTags: ${data.tags.join(', ')}`
        }

        return {
          content: [
            {
              type: 'text',
              text: response
            }
          ]
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr (stdout is used for MCP protocol)
  console.error('The Librarian MCP server running')
  console.error(`API Base URL: ${API_BASE_URL}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
