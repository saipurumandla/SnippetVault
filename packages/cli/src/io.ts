export interface Io {
  stdin: NodeJS.ReadableStream & { isTTY?: boolean };
  stdout: { write(s: string): unknown; isTTY?: boolean };
  stderr: { write(s: string): unknown; isTTY?: boolean };
  env: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}

export const processIo = (): Io => ({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, env: process.env });

export function useColor(io: Io): boolean {
  return !!io.stderr.isTTY && !('NO_COLOR' in io.env) && io.env.TERM !== 'dumb';
}

export function red(io: Io, s: string) {
  return useColor(io) ? `\x1b[31m${s}\x1b[0m` : s;
}

export function yellow(io: Io, s: string) {
  return useColor(io) ? `\x1b[33m${s}\x1b[0m` : s;
}

export async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export class CliError extends Error {}
