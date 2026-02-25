# The Librarian MCP Server

A Model Context Protocol (MCP) server that allows Claude to interact with your Librarian RSS application. With this integration, you can ask Claude to read articles, manage your saved content, and organize your reading list.

## Features

### Read Tools
- **list_feeds** - Get all your subscribed RSS feeds
- **get_recent_articles** - Fetch recent articles with filtering options
- **search_articles** - Search for articles by criteria
- **get_article** - Get full content of a specific article

### Write Tools
- **save_article** - Save articles for later reading
- **unsave_article** - Remove articles from saved
- **get_saved_articles** - View all saved articles (with optional tag filtering)
- **tag_article** - Add or update tags on saved articles

## Setup

### 1. Prerequisites

- Your Librarian app running locally (usually on `http://localhost:3001`)
- Claude Desktop installed
- Logged in to your Reader account

### 2. Configure Claude Desktop

You need to add the MCP server configuration to Claude Desktop's config file.

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration (update the paths to match your system):

```json
{
  "mcpServers": {
    "the-librarian": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/path/to/reader/node_modules/.bin/tsx",
        "/Users/YOUR_USERNAME/path/to/reader/mcp-server/index.ts"
      ],
      "env": {
        "READER_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

**Important**: Replace `/Users/YOUR_USERNAME/path/to/reader` with the actual absolute path to your Reader project.

### 3. Get the Absolute Path

To find your project's absolute path, run this in your Reader project directory:

```bash
pwd
```

Then use that path in the configuration above.

### 4. Restart Claude Desktop

After updating the configuration, completely quit and restart Claude Desktop for the changes to take effect.

### 5. Verify Connection

In Claude Desktop, you can verify the MCP server is connected by:
1. Looking for the 🔌 icon in the chat interface
2. Asking Claude: "What MCP tools do you have access to?"
3. Claude should list the 10 Librarian tools

## Usage Examples

Once configured, you can interact with your Reader through Claude:

### Reading Articles

```
"What are my recent unread articles?"
"Show me articles from TechCrunch"
"What's in my RSS feeds today?"
```

### Saving & Organizing

```
"Save the article about renewable energy"
"Show me all my saved articles"
"Tag this article with 'machine-learning' and 'tutorial'"
"What articles have I saved with the tag 'AI'?"
```

### Managing Feeds

```
"List all my RSS feeds"
"How many unread articles do I have?"
```

## Environment Variables

- `READER_API_URL` - Base URL of your Reader API (default: `http://localhost:3001`)
- `READER_API_KEY` - Optional: API key for authentication (if your deployment requires it)

## Troubleshooting

### Claude Can't See the Tools

1. Make sure the paths in `claude_desktop_config.json` are absolute, not relative
2. Verify Claude Desktop is completely restarted
3. Check that your Reader app is running

### Authentication Errors

The MCP server connects to your Reader API. Make sure:
1. Your Reader app is running (`npm run dev`)
2. You're logged in to the Reader web interface
3. The API URL is correct in the configuration

### Tool Errors

If a tool fails:
1. Check that your Reader app is running and accessible
2. Look at the error message - it will include details
3. Verify the article/feed IDs are correct (use `list_feeds` or `get_recent_articles` first)

## Development

### Testing the Server Manually

You can test the MCP server directly:

```bash
npm run mcp
```

This starts the server in stdio mode. It will wait for MCP protocol messages on stdin.

### Adding New Tools

1. Add the tool definition to the `tools` array in `mcp-server/index.ts`
2. Add a case handler in the `CallToolRequestSchema` handler
3. Update `types/api.ts` if you need new type definitions
4. Restart Claude Desktop to see the new tool

## Architecture

```
Claude Desktop
    ↓ (stdio via MCP)
MCP Server (mcp-server/index.ts)
    ↓ (HTTP)
Reader Nuxt API (http://localhost:3001/api/*)
    ↓
Database (Supabase Postgres)
```

The MCP server:
- Runs as a separate Node.js process launched by Claude Desktop
- Communicates with Claude via stdin/stdout using the MCP protocol
- Makes HTTP requests to your Reader API
- Shares TypeScript types with the main app
