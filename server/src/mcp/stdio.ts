import '../config.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { verifyAccessToken } from '../tokens.js';
import { createVaultServer } from './server.js';

// stdout belong to the mcp protocol, so errors go to stderr only
const owner = verifyAccessToken(process.env.SNIPPETVAULT_TOKEN ?? '');
if (!owner) {
  console.error('SNIPPETVAULT_TOKEN is missing, wrong or revoked. Create one under Access tokens.');
  process.exit(1);
}

await createVaultServer(owner).connect(new StdioServerTransport());
