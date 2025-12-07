# SnippetVault v2.0.0

Self-hosted code snippet manager for developer teams. Store, tag, search, and securely
share code snippets with VS Code theming, a command palette, hybrid encryption, and
AI-assisted search and code assistance powered by local Ollama models.

## Requirements

- Node.js 20+
- npm 10+
- [Ollama](https://ollama.ai) (for local AI features — optional)

## Install

```bash
npm install
npm install --prefix client
cp .env.example .env
# Edit .env — set JWT_SECRET and MASTER_KEY (64 hex chars)
```

Generate MASTER_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running

```bash
npm run dev        # server on :3001, client on :5173
npm start          # production server only
```

## Configuration

| Variable       | Default         | Description                          |
|----------------|-----------------|--------------------------------------|
| PORT           | 3001            | Server port                          |
| DB_PATH        | ./data/vault.db | SQLite database path                 |
| JWT_SECRET     | (required)      | JWT signing secret                   |
| MASTER_KEY     | (required)      | 64-char hex key for envelope enc     |
| LOG_LEVEL      | info            | pino log level                       |
| JWT_EXPIRES_IN | 24h             | JWT token TTL                        |
| OPENAI_API_KEY | (optional)      | For RAG answer generation            |
| OLLAMA_HOST    | localhost       | Ollama server host                   |
| OLLAMA_PORT    | 11434           | Ollama server port                   |

## Features

**Core (v1.0.0 — 2022)**
- Snippet CRUD with Monaco Editor syntax highlighting
- VS Code dark/light theme with CSS custom properties
- Language filter sidebar, full-text search (SQLite FTS5), tags
- Project workspaces with member access control
- Command palette (Ctrl+K)
- Standard snippet envelope encryption (AES-256-GCM server-side)
- Sensitive snippet client-side encryption (libsodium sealed box)
- Expiry policy for short-lived secret snippets
- Security event log, rate limiting, request validation
- Encrypted backup and restore

**RAG Search Assistant (v2.0.0 — 2025)**
- Natural-language questions over your snippet knowledge base
- Hybrid retrieval: BM25 + vector similarity with reranking
- Citation-first answers — every answer cites source snippets
- Encrypted sensitive snippets excluded from indexing by default
- Prompt-injection defenses on all retrieval paths

**Local Ollama Copilot (v2.0.0 — 2025)**
- Explain, summarize, refactor-draft actions on any snippet
- Local inference only — no cloud model required
- Streaming responses with cancel and copy controls
- Secret redaction filter on all streamed tokens
- Approved model allowlist: qwen2.5-coder, llama3.1, mistral

## RAG Setup

Index your snippets after setup:
```bash
npm run index
```

Re-run after adding snippets or changing content.

Sensitive (encrypted) snippets are excluded from the index unless you
give explicit per-request consent from the UI.

## Ollama Setup

Install Ollama and pull a model:
```bash
ollama pull qwen2.5-coder
```

The assistant panel detects Ollama availability on load. Set `OLLAMA_HOST`
and `OLLAMA_PORT` if Ollama runs on a different machine.

## Security Notes

- Sensitive snippet plaintext never leaves the browser
- Private keys never sent to the server
- Passphrase-locked private key stored encrypted in localStorage
- Unlock sessions clear after 15 minutes of inactivity
- Rate limiting on auth and sensitive endpoints
- Security events logged for decrypt, share, export, and revoke
- RAG answers blocked if no valid citation anchors are present
- Ollama requests restricted to approved model list

## Backup and Recovery

Export (standard snippets only, encrypted):
```
GET /api/backup/export?passphrase=<passphrase>
```

Restore:
```
POST /api/backup/restore?passphrase=<passphrase>
```

## Health

```
GET /health   — process alive
GET /ready    — DB connectivity
```

## Testing

```bash
npm test
```

---

## License

MIT, see [LICENSE](LICENSE).
