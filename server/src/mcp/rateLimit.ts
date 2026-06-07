const WINDOW_MS = 60_000;
export const CALLS_PER_MINUTE = Number(process.env.MCP_CALLS_PER_MINUTE) || 60;

const calls = new Map<number, number[]>();

export function takeCall(tokenId: number, now = Date.now()): boolean {
  const recent = (calls.get(tokenId) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= CALLS_PER_MINUTE) {
    calls.set(tokenId, recent);
    return false;
  }
  recent.push(now);
  calls.set(tokenId, recent);
  return true;
}
