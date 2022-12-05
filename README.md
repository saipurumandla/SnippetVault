# SnippetVault v1.0.0

Self-hosted code snippet manager for developer teams. Store, tag, search, and securely share
code snippets. VS Code dark/light theming, command palette, hybrid encryption for sensitive
snippets, and time-bound expiry for secret env snippets.

## Requirements

- Node.js 16+
- npm 8+

## Install

```bash
# Server dependencies
npm install

# Client dependencies
npm install --prefix client

# Copy and configure env
cp .env.example .env
# Edit .env — set JWT_SECRET and MASTER_KEY (64 hex chars)
```

Generate MASTER_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running

Development (server + client with hot reload):
```bash
npm run dev
```

Production:
```bash
npm run build --prefix client
npm start
```

Server runs on port 3001 by default. Client dev server on 5173.

## Configuration

| Variable       | Default              | Description                        |
|----------------|----------------------|------------------------------------|
| PORT           | 3001                 | Server port                        |
| DB_PATH        | ./data/vault.db      | SQLite database path               |
| JWT_SECRET     | (required)           | JWT signing secret                 |
| MASTER_KEY     | (required)           | 64-char hex key for envelope enc   |
| LOG_LEVEL      | info                 | pino log level                     |
| JWT_EXPIRES_IN | 24h                  | JWT token TTL                      |

## Features

- Snippet CRUD with Monaco Editor (syntax highlighting)
- VS Code dark/light theme with CSS custom properties
- Language filter sidebar and full-text search (SQLite FTS5)
- Project workspaces with member access control
- Tags on snippets
- Command palette (Ctrl+K) for navigation and actions
- Standard snippet envelope encryption (AES-256-GCM server-side)
- Sensitive snippet client-side encryption (libsodium sealed box)
- Expiry policy for short-lived secret snippets
- Security event log
- Encrypted backup and restore

## Backup and Recovery

Export a backup (standard snippets only, encrypted with your passphrase):
```
GET /api/backup/export?passphrase=<your-passphrase>
```

Restore from backup:
```
POST /api/backup/restore?passphrase=<your-passphrase>
Content-Type: text/plain
Body: <contents of .enc backup file>
```

## Health Checks

```
GET /health   — process alive
GET /ready    — DB connectivity check
```

## Testing

```bash
npm test
```

## Security Notes

- Sensitive snippet plaintext is never sent to the server
- Private keys never leave the browser
- Passphrase-locked private key is stored in localStorage (encrypted)
- Unlock sessions clear after 15 minutes of inactivity
- Rate limiting enabled on auth and share endpoints
- Security events logged for decrypt, share, export, and revoke actions

---

## License

MIT, see [LICENSE](LICENSE).
