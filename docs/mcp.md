# Use the vault from AI agents (MCP)

SnippetVault is an MCP server. Agents and editors that speak MCP (Cursor, VS Code,
and others) can search your snippets, read them, and suggest new ones. They can never
save or change a snippet on their own: suggestions wait in **Drafts** until you accept
them.

## 1. Make a token

In the app open **Access tokens** and click **New token**.

| Scope | What the agent can do |
|---|---|
| `read` | `search_snippets`, `get_snippet`, `list_tags` |
| `propose` | `propose_snippet` (goes to Drafts) |

The token is shown one time. It starts with `sv_`. Revoke it any time on the same page,
it stops working on the next tool call.

## 2. Connect the client

There are two ways. HTTP is simpler when the server is already running.

### Over HTTP (server running)

Any client with Streamable HTTP support needs the URL and one header:

- URL: `http://localhost:3001/mcp`
- Header: `Authorization: Bearer sv_your_token`

Cursor, in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "snippetvault": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer sv_your_token" }
    }
  }
}
```

VS Code, in `.vscode/mcp.json`:

```json
{
  "servers": {
    "snippetvault": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer sv_your_token" }
    }
  }
}
```

### Over stdio (no server needed)

The client starts the MCP server itself and opens the SQLite file directly. Build once
with `npm run build`, then configure the command:

```json
{
  "mcpServers": {
    "snippetvault": {
      "command": "node",
      "args": ["/path/to/SnippetVault/server/dist/mcp/stdio.js"],
      "env": {
        "SNIPPETVAULT_TOKEN": "sv_your_token",
        "DB_PATH": "/path/to/SnippetVault/data/vault.db"
      }
    }
  }
}
```

## Tools

| Tool | Input | Returns |
|---|---|---|
| `search_snippets` | `query`, optional `language`, `limit` (max 20) | best matches with a short excerpt |
| `get_snippet` | `id` | full code, title, tags |
| `list_tags` | none | tags with counts |
| `propose_snippet` | `title`, `code`, `language`, optional `description`, `tags` | a draft id |

## What agents never see

- Sensitive snippets. Not in search, not by id, not their tags. A sensitive id answers
  the same as a missing one.
- Expired snippets, and private snippets of other people.

## Limits and logging

- 60 tool calls per minute per token (`MCP_CALLS_PER_MINUTE` to change)
- 50 drafts waiting at most, then `propose_snippet` asks the user to review first
- every tool call is in **Security events**, with the token name
- `/mcp` refuses requests from browsers (they always send an `Origin` header)

## Check it works

Ask your agent something like "search my snippetvault for retry code". The answer
should cite a snippet id, and a `search_snippets` row shows up in Security events.
