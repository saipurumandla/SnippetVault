import express from 'express';
import type { RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyAccessToken, type TokenOwner } from '../tokens.js';
import { createVaultServer } from '../mcp/server.js';

const router = express.Router();

function rpcError(code: number, message: string) {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

// browsers send Origin, agents dont. stop dns rebinding
const noBrowsers: RequestHandler = (req, res, next) => {
  if (req.headers.origin) {
    res.status(403).json(rpcError(-32000, 'Browser requests are not allowed on /mcp'));
    return;
  }
  next();
};

const tokenAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const owner = header.startsWith('Bearer ') ? verifyAccessToken(header.slice(7)) : null;
  if (!owner) {
    res.status(401).set('WWW-Authenticate', 'Bearer').json(rpcError(-32001, 'Missing or invalid access token'));
    return;
  }
  res.locals.owner = owner;
  next();
};

router.post('/', noBrowsers, tokenAuth, async (req, res) => {
  const server = createVaultServer(res.locals.owner as TokenOwner);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

router.all('/', (req, res) => {
  res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Method not allowed, use POST'));
});

export default router;
