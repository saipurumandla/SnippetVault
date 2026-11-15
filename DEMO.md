# SnippetVault demo

Self-hosted snippet manager for developer teams. Store, tag, search and share code,
with an assistant that runs on your own Ollama. No cloud account.

Screenshots are the dark theme. Light theme looks the same with light colours.

---

## Login

![Login](docs/screenshots/01-login.png)

Email and password. Auth is JWT + bcrypt.

---

## Vault

![Vault](docs/screenshots/02-vault.png)

The main screen works like a mail client for code:

- **List on the left** — one row per snippet: title, language, tags, last change
- **Preview on the right** — the code of the selected row, with Copy code, Edit and Open
- **Filters** — language, project and tag menus above the list
- **Search** — press `/`, it searches title, description and code (SQLite FTS5)
- **Keyboard** — `↑ ↓` move, `Enter` open, `N` new snippet, `Ctrl K` palette

---

## Snippet detail

![Snippet detail](docs/screenshots/03-snippet-detail.png)

The code in Monaco, with language, visibility, tags and dates. The assistant is in the
right column: Explain, Summarize, Draft a refactor, Convert to another language.

---

## Assistant — Explain

![Explain](docs/screenshots/04-ai-explain.png)

Answers stream into a side sheet and render as markdown. Sources at the bottom link to
the snippets the answer used. Stop ends the stream, `Esc` closes the sheet.

---

## Assistant — Refactor draft

![Refactor draft](docs/screenshots/05-ai-refactor.png)

The explanation comes first, then the suggested code. **Apply and save** writes it to
the snippet. Nothing is saved until you click it.

---

## Assistant — Convert

![Convert](docs/screenshots/06-ai-convert.png)

Pick a target language and click Convert. **Save as new snippet** keeps the result as a
new private snippet. If the code can't be converted (for example browser-only APIs to
Go), the model says why instead of making something up.

---

## Suggest title in the editor

![Suggest title](docs/screenshots/07-ai-suggest.png)

**Suggest title** reads the code and fills title and description. Good titles also help
search.

---

## Ask your vault

![Ask your vault — answer](docs/screenshots/08-01-rag-panel.png)

![Ask your vault — sources](docs/screenshots/08-02-rag-panel.png)

Ask a question in plain words. How it works:

1. Hybrid retrieval — keyword match (FTS5) plus vector search (sqlite-vec, local
   embeddings with `@huggingface/transformers`)
2. Only snippets you are allowed to read are used, sensitive ones never
3. Ollama writes the answer, and it must cite at least one snippet or it is not shown
4. `#N` in the answer and the source buttons select that snippet in the preview

New and edited snippets are indexed when they are saved.

---

## Sources in the preview

![Citation in preview](docs/screenshots/09-citation-preview.png)

Clicking a source selects the snippet in the list and shows it in the preview pane.
The answer stays open, you don't lose your place.

---

## Command palette

![Command palette](docs/screenshots/10-command-palette.png)

`Ctrl K` from anywhere. Finds snippets, projects, tags and actions like New snippet or
Settings. Arrows move, `Enter` opens, `Esc` closes.

---

## Projects

![Projects](docs/screenshots/11-projects.png)

Projects group snippets for a team or a repo. Add members by email. Snippets with
**Project** visibility are only visible to members.

---

## Agents (MCP)

![Drafts from agents](docs/screenshots/12-drafts.png)

Cursor, VS Code and other MCP clients can search and read the vault, and suggest
new snippets. Suggestions land in **Drafts**. Accept, edit first, or reject.

![Draft with a secret](docs/screenshots/12-02-drafts-secret.png)

If a suggested snippet looks like it has a secret in it (API keys, tokens, private
keys), Drafts says so before you save it as plain text.

![Access tokens](docs/screenshots/13-access-tokens.png)

Each agent gets its own token with `read` and/or `propose` scope. Revoke it and the
agent stops on its next call.

![Security events](docs/screenshots/14-security-events.png)

Every tool call is logged with the token name. Setup: [docs/mcp.md](docs/mcp.md).

---

## Terminal and VS Code

![Search from VS Code](docs/screenshots/15-vscode-search.png)

The VS Code extension searches as you type and opens the snippet in a new tab.
Insert snippet puts it at the cursor with your indent.

![Hover a vault link](docs/screenshots/16-vscode-hover.png)

`snippetvault://1` in a comment shows the snippet on hover.

![Save selection](docs/screenshots/17-vscode-save.png)

Select code, right click, **Save selection as snippet**. The language comes from the
editor.

```bash
$ sv find retry
#1  Retry fetch with exponential backoff                typescript  async, http
$ sv get 1 --copy
Copied #1 Retry fetch with exponential backoff
```

`sv` does the same from the terminal. Setup: [docs/cli.md](docs/cli.md),
[docs/vscode.md](docs/vscode.md).

---

## Ask your vault, with lookups

![Ask with lookups](docs/screenshots/19-ask-with-lookups.png)

The assistant searches the vault itself, here once for both parts of the question, and
cites what it used. Each lookup is listed above the answer. At most 6 per question.

---

## Duplicates and tag ideas

![Duplicate check](docs/screenshots/20-duplicate-check.png)

Saving something you already have asks first. This copy had other variable names and
still matched at 87%.

![Tag ideas](docs/screenshots/21-tag-ideas.png)

**Suggest tags** offers tags from similar snippets and from the model. Click the ones you
want, nothing is added by itself.

---

## Assistant model

![Assistant settings](docs/screenshots/18-assistant-settings.png)

Local Ollama by default. With your own key Anthropic or OpenAI can be used, but only for
snippets you (or the project owner) allowed. Sensitive snippets never go out.

---

## Storage modes

| Mode | Stored as | Search | Assistant | Who can read |
|------|-----------|--------|-----------|--------------|
| **Standard** | plain text | full text + semantic | yes | visibility setting |
| **Sensitive** | encrypted in the browser (libsodium) | no | no | you and the people you share with |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24, TypeScript 5.9, npm workspaces |
| Backend | Express 5, better-sqlite3, numbered SQL migrations |
| Frontend | React 19, React Router 7, Vite 7, Monaco Editor |
| Auth | JWT + bcrypt |
| Search | SQLite FTS5 + sqlite-vec |
| Embeddings | @huggingface/transformers (all-MiniLM-L6-v2) |
| Assistant | Ollama on your machine by default (qwen3-coder:30b), opt-in Anthropic or OpenAI with your key |
| Retrieval | FTS5 bm25 + sqlite-vec, optional cross encoder reranker, eval in `eval/` |
| Encryption | libsodium in the browser, AES-256-GCM for backups |
| Agents | MCP server (stdio and Streamable HTTP), `@modelcontextprotocol/sdk` |
| Terminal and editor | `sv` CLI (commander), VS Code extension, one shared typed API client |
| Tests | Vitest, Supertest, React Testing Library |
| UI | IBM Plex Sans and Mono, Lucide icons, see [DESIGN.md](DESIGN.md) |
