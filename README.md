# SnippetVault

Self-hosted, local-first code snippet manager for developer teams. Store, tag, search and share code snippets. Sensitive snippets are encrypted in the browser, and the assistant runs on your own Ollama.

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
| `OLLAMA_DEFAULT_MODEL`| qwen3-coder:30b      | Model used for explain/summarize/refactor     |
| `RAG_MODEL`           | qwen3-coder:30b      | Model used for RAG answer generation         |

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

### RAG Search Assistant
Ask natural-language questions across your snippet knowledge base:
- Hybrid retrieval: BM25 keyword match (SQLite FTS5) + vector search with [sqlite-vec](https://github.com/asg017/sqlite-vec) (local embeddings via `@huggingface/transformers`)
- Citation-first — answers that don't cite a source snippet are blocked from rendering
- `#N` references and the source buttons select that snippet in the vault preview
- Prompt-injection defenses on all retrieval paths
- Sensitive encrypted snippets excluded from indexing

**Indexing is automatic** — snippets are indexed in the background whenever you create or edit them. No manual `npm run index` needed (though it still works as a one-time backfill for existing snippets).

### Local Ollama AI assistant
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

### UI
See [DESIGN.md](DESIGN.md). Short version:
- IBM Plex Sans for UI, IBM Plex Mono for code, bundled (no font CDN)
- Light and dark theme, follows the system setting
- One blue accent, structure from 1px lines, no gradients or glow
- Lucide icons, 16px
- Every list and form has empty, loading and error states

---

## Ollama Setup

Install Ollama, then pull a model:

```bash
ollama pull qwen3-coder:30b
```

The assistant panel detects Ollama availability on load. Change the default model in `.env`:

```
OLLAMA_DEFAULT_MODEL=qwen3-coder:30b
RAG_MODEL=qwen3-coder:30b
```

Approved models: `qwen3-coder:30b`, `qwen2.5-coder`, `qwen2.5-coder:7b`, `llama3.1`, `llama3.1:8b`, `mistral`.

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

- Sensitive snippet plaintext is never transmitted to the server
- Private keys are never sent over the network
- Passphrase-derived key used to encrypt the private key locally (libsodium `pwhash`)
- All AI actions reject sensitive snippets to prevent plaintext exposure
- RAG answers require at least one valid citation anchor — uncited responses are blocked
- Streamed AI tokens pass through a secret-redaction filter before reaching the UI
- Ollama model selection restricted to an approved allowlist

---

## License

MIT, see [LICENSE](LICENSE).
