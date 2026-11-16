# SnippetVault

Self-hosted, local-first code snippet manager for developer teams. Store, tag, search and share code snippets. Sensitive snippets are encrypted in the browser, and the assistant runs on your own Ollama by default.

Screenshots and a walk through: [DEMO.md](DEMO.md). UI rules: [DESIGN.md](DESIGN.md).

---

## Requirements

- Node.js 24+ (see `.nvmrc`)
- npm 11+
- [Ollama](https://ollama.ai) — for AI features (optional)

---

## Install

```bash
# server and client are npm workspaces, one install does both
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` and set at minimum:

```
JWT_SECRET=<long random string>
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Running

```bash
npm run dev        # server :3001 (tsx watch) + Vite client :5173
npm run build      # tsc for server, vite build for client
npm start          # server from server/dist (run build first)
```

Checks (same as CI):

```bash
npm run typecheck  # tsc for server and client
npm run lint       # eslint, and stylelint for the design rules in DESIGN.md
npm test           # vitest for server and client
```

Open **http://localhost:5173** in your browser.

---

## Database

SQLite file at `data/vault.db`. Schema changes are numbered SQL files in
`server/migrations/`. They run automatic when the server starts, or by hand:

```bash
npm run migrate
```

Never edit a migration after it is merged, add a new one.

Vector search use [sqlite-vec](https://github.com/asg017/sqlite-vec) inside the same
SQLite file, no extra service. To rebuild the search index from all snippets:

```bash
npm run index
```

---

## Configuration

| Variable              | Default              | Description                                  |
|-----------------------|----------------------|----------------------------------------------|
| `PORT`                | 3001                 | Server port                                  |
| `DB_PATH`             | ./data/vault.db      | SQLite database path                         |
| `JWT_SECRET`          | *(required)*         | JWT signing secret                           |
| `JWT_EXPIRES_IN`      | 24h                  | Token TTL                                    |
| `LOG_LEVEL`           | info                 | pino log level                               |
| `OLLAMA_HOST`         | localhost            | Ollama server host                           |
| `OLLAMA_PORT`         | 11434                | Ollama server port                           |
| `OLLAMA_DEFAULT_MODEL`| qwen3.6:27b          | Model used for explain/summarize/refactor     |
| `RAG_MODEL`           | qwen3.6:27b          | Model used for RAG answer generation         |
| `EMBEDDINGS`          | on                   | `off` skips the embedding model, Ask your vault is off |
| `MASTER_KEY`          | *(none)*             | 64 hex chars, needed to store cloud API keys |
| `RERANK`              | off                  | `on` adds a cross encoder reranker, see the eval first |
| `AGENT_TIMEOUT_MS`    | 90000                | Time limit for one Ask your vault question   |
| `DUPLICATE_THRESHOLD` | 0.85                 | Similarity for the duplicate warning         |

---

## Features

### Snippet management
- Vault as a list with a code preview next to it, like a mail client
- Monaco Editor with syntax highlighting for 16 languages
- Tag editor — type and press Enter
- Filters for language, project and tag
- Full-text search across title, description and code (SQLite FTS5)
- Projects with member access control
- Visibility: Private / Project / Shared
- Command palette (`Ctrl K`) — snippets, projects, tags and actions
- Keyboard: `/` search, `N` new snippet, `↑ ↓` move, `Enter` open

### Encryption model
Two modes — choose per snippet:

| Mode | Storage | Searchable | AI features |
|------|---------|-----------|-------------|
| **Standard** | Plaintext — access controlled by visibility | ✓ | ✓ |
| **Sensitive** | Client-side encrypted (libsodium sealed box) before upload | ✗ | ✗ |

Sensitive mode: your private key is generated in the browser, encrypted with your passphrase, and stored in `localStorage`. The server stores ciphertext only and cannot decrypt. Unlock sessions expire after 15 minutes of inactivity. Clipboard auto-clears after 45 seconds when copying sensitive content.

### Security
- Rate limiting on auth and sensitive endpoints (express-rate-limit)
- Request validation with Zod on all write routes
- Security event log — every share of a sensitive snippet is recorded
- Sensitive snippet expiry — set a date/time after which the snippet is hidden and moved to the Expired tab
- Encrypted backup / restore — AES-256-GCM, key derived from your passphrase on the server (scrypt). Use a passphrase only for backups

### Ask your vault
Ask a question in plain words. The assistant looks things up itself:
- Tools `search_vault` and `get_snippet`, at most 6 lookups and a time limit per question
- Search is hybrid: keyword match (SQLite FTS5, ranked by bm25) plus vectors with [sqlite-vec](https://github.com/asg017/sqlite-vec), local embeddings via `@huggingface/transformers`
- Every answer must cite the snippets it used, uncited answers are not shown
- The panel shows each lookup, and `#N` or a source button opens that snippet
- Only snippets you can read, never sensitive ones, never expired ones

New and edited snippets are indexed when saved. `npm run index` rebuilds everything.

Quality is measured, not guessed: see [Retrieval eval](#retrieval-eval).

### Duplicates and tags
- Saving a new snippet that looks like one you already have (same code, or 85%+ similar) asks first: open the existing one, or save anyway
- **Suggest tags** in the editor offers tags from similar snippets and from the model. Nothing is added until you click it

### Assistant actions
Per-snippet actions on the detail page:

| Action | Description |
|--------|-------------|
| **Explain** | Plain-English explanation of what the code does |
| **Summarize** | 2–3 sentence summary |
| **Refactor draft** | One suggested improvement — extract the code and apply it with one click |
| **Convert to language** | Converts code to a selected target language; refuses clearly if the conversion isn't feasible (e.g. browser-only APIs) |

All actions stream into a side sheet:
- Markdown with language-labelled code blocks and a **Copy** button
- Refactor: **Apply and save** writes the suggested code to the snippet
- Convert: **Save as new snippet** gets a title from the model, then saves a new private snippet

**Suggest title** (in the snippet editor) reads your code and fills title and description.

### Assistant model
Local Ollama is the default and nothing leaves your server. In **Settings** you can switch
to Anthropic or OpenAI with your own API key:
- The key is stored encrypted with `MASTER_KEY`, only the last 4 characters are shown again
- A cloud model only sees snippets whose owner allowed it: you for personal snippets, the
  project owner for project snippets (Projects page)
- Sensitive snippets are blocked at the provider boundary, not only in the UI, and the same
  secret filter runs on everything sent out. Tests in `server/test/cloud.test.js` cover it
- Model ids come from settings, nothing is hardcoded

### UI
See [DESIGN.md](DESIGN.md). Short version:
- IBM Plex Sans for UI, IBM Plex Mono for code, bundled (no font CDN)
- Light and dark theme, follows the system setting
- One blue accent, structure from 1px lines, no gradients or glow
- Lucide icons, 16px
- Every list and form has empty, loading and error states

---

## Agents (MCP)

AI agents and editors (Cursor, VS Code, any MCP client) can use the vault as an MCP server: search
snippets, read them, and suggest new ones. Suggestions wait in **Drafts** until you
accept them, agents never write to the vault directly. Sensitive snippets are never
visible to agents.

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

Tokens are made under **Access tokens** in the app. Full setup, stdio mode and Cursor
config and VS Code: [docs/mcp.md](docs/mcp.md).

---

## Terminal and VS Code

`sv` saves and finds snippets from the terminal, the VS Code extension searches,
inserts and saves from the editor. Both use an access token with `read` and `write`.

```bash
sv login
cat deploy.sh | sv save -t "Deploy to staging" --tag ops
sv find deploy
sv get 14 --copy
```

Setup and all options: [docs/cli.md](docs/cli.md) and [docs/vscode.md](docs/vscode.md).
CI builds both as artifacts (`.vsix` and a `.tgz`), nothing is published.

---

## Ollama Setup

Install Ollama, then pull a model:

```bash
ollama pull qwen3.6:27b
```

The assistant panel detects Ollama availability on load. Change the default model in `.env`:

```
OLLAMA_DEFAULT_MODEL=qwen3.6:27b
RAG_MODEL=qwen3.6:27b
```

Any model installed in Ollama can be used, Settings lists them. Tool calling needs a model
that supports tools. `qwen3.6:27b` is the default (about 17 GB, fits one 24 GB GPU).
`qwen3-coder:30b` is about 10x faster and a bit less exact, good on smaller machines.
Thinking is off by default, `OLLAMA_THINK=on` turns it on (about 3x slower).

---

## Retrieval eval

`npm run eval` loads 42 snippets in 13 languages into a temporary database and asks 52
labelled questions (18 use the snippet's own words, 34 say it another way). No model judges
anything, the labels are in [eval/questions.json](eval/questions.json).

| Mode | Recall@1 | Recall@5 | MRR@5 | MRR paraphrase | ms / query |
|---|---|---|---|---|---|
| Keyword only (FTS5) | 0.736 | 0.851 | 0.793 | 0.684 | 0 |
| **Hybrid, default** | **0.832** | **0.918** | **0.870** | **0.801** | 2 |
| Hybrid + reranker | 0.813 | 0.880 | 0.851 | 0.772 | 74 |

The first run of the eval found that keyword matches were not ordered by score at all
(MRR 0.314). After that fix the reranker did not help anymore and costs 35x the time, so it
is off by default. Full report: [eval/REPORT.md](eval/REPORT.md).

---

## Backup and Recovery

Export (standard snippets, encrypted with your passphrase):
```
GET /api/backup/export?passphrase=<passphrase>
```

Restore:
```
POST /api/backup/restore?passphrase=<passphrase>
Content-Type: text/plain
Body: <contents of .enc file>
```

---

## Health Endpoints

```
GET /health   — process uptime
GET /ready    — DB connectivity check
```

---

## Security Notes

- Sensitive snippet plaintext is never transmitted to the server (sealed box to your own public key, libsodium sumo build)
- The server refuses a sensitive snippet that was not encrypted in the browser
- Before v3.0.1 key setup failed (the standard libsodium build has no `crypto_pwhash`), and a sensitive snippet sent by the API was stored as plain text. Such snippets show a warning; open them in the editor and save once to encrypt them
- Private keys are never sent over the network
- Passphrase-derived key used to encrypt the private key locally (libsodium `pwhash`)
- All AI actions reject sensitive snippets to prevent plaintext exposure
- RAG answers require at least one valid citation anchor — uncited responses are blocked
- Streamed AI tokens pass through a secret-redaction filter before reaching the UI
- Ollama model selection restricted to an approved allowlist

---

## License

MIT, see [LICENSE](LICENSE).
