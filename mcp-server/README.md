# Reader MCP server

A Model Context Protocol (MCP) server that lets Claude Desktop read and manage your Reader
(`reader.phareim.no`): feeds, articles, full-text search, the shelf and tags. It is a local stdio
process that calls the Reader API with your personal MCP token. In Claude Desktop's config it is
registered under the key `the-librarian` (the project's first name); installed configs use that key,
so it stays.

No agent config on Sleeper registers this server; it is only used from a Claude Desktop install that
points at a clone of this repo.

## Tools (11)

Read:
- **list_feeds** — subscribed feeds with unread counts and tags (`GET /api/feeds`)
- **get_recent_articles** — articles filtered by feed and read status, with `limit`/`offset` (`GET /api/articles`)
- **search_articles** — with `q`, ranked full-text search with snippets (`GET /api/search`); without, a filtered list
- **get_article** — one article with its full body (`GET /api/articles/:id`)
- **get_saved_articles** — the shelf, optionally by tag (`__inbox__` = untagged) (`GET /api/saved-articles`)
- **list_tags** — tags with usage counts (`GET /api/tags`)

Write:
- **save_article** / **unsave_article** — `POST` / `DELETE /api/articles/:id/save`
- **tag_article** — replace a saved article's tags (`PATCH /api/saved-articles/:id/tags`)
- **add_article** — add a non-RSS article and save it (`POST /api/articles/manual`)
- **delete_article** — delete a manual or Found article (`DELETE /api/articles/:id/delete`)

## Setup

1. Sign in to Reader and open `/mcp-settings`; generate a token there.
2. From your clone of this repo (with `npm install` done), run:
   ```bash
   ./setup-mcp.sh --token YOUR_TOKEN
   ```
   or `curl -s https://reader.phareim.no/api/install-mcp | bash -s -- --token YOUR_TOKEN`.
   The script writes the `the-librarian` entry into Claude Desktop's config
   (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS).
3. Quit and restart Claude Desktop.

The entry it writes looks like this:

```json
{
  "mcpServers": {
    "the-librarian": {
      "command": "node",
      "args": [
        "/absolute/path/to/reader/node_modules/.bin/tsx",
        "/absolute/path/to/reader/mcp-server/index.ts"
      ],
      "env": {
        "READER_API_URL": "https://reader.phareim.no",
        "MCP_TOKEN": "your-token"
      }
    }
  }
}
```

## Environment variables

- `READER_API_URL` — base URL of the Reader API. `setup-mcp.sh` writes `https://reader.phareim.no`;
  without it the server falls back to `http://localhost:3000` (`npm run dev`).
- `MCP_TOKEN` — your token from `/mcp-settings`, sent as `X-MCP-Token`. Regenerating or revoking it
  on that page stops this server (and every other client using the token) until the config has the new one.

## Troubleshooting

- **No tools in Claude:** the paths in the config must be absolute, and Claude Desktop must be fully
  restarted.
- **401 errors:** the token is wrong, regenerated or revoked — generate a new one and re-run the script.
- **Tool errors:** the message includes the API status and body; use `list_feeds` or
  `get_recent_articles` to find valid ids.

## Development

```bash
npm run mcp   # starts the server on stdio; it waits for MCP messages
```

To add a tool: add it to the `tools` array in `mcp-server/index.ts`, add its case to the
`CallToolRequestSchema` handler, and extend `types/api.ts` if the response needs a new type.

More: [`docs/architecture/mcp-server.md`](../docs/architecture/mcp-server.md).
