# SnippetVault for VS Code

Search, save and insert snippets from your own SnippetVault server.

| Command | What it does |
|---|---|
| SnippetVault: Search vault | find a snippet and open it |
| SnippetVault: Insert snippet | put a snippet at the cursor, keeps your indent |
| SnippetVault: Save selection as snippet | save selected code (or the whole file) |
| SnippetVault: Set access token | connect to your server |

Hover a `snippetvault://12` link in any file to see that snippet.

## Setup

1. In the SnippetVault web app open **Access tokens** and make a token with
   `read` (and `write` if you want to save from the editor)
2. Run **SnippetVault: Set access token** and paste it
3. If the server is not on `http://localhost:3001`, change `snippetvault.serverUrl`

The token is kept in VS Code secret storage, not in settings.
Sensitive snippets never show up here, they only open in the web app.
