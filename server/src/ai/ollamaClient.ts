import http from 'node:http';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);

export const APPROVED_MODELS = [
  'qwen3-coder:30b',
  'qwen2.5-coder', 'qwen2.5-coder:7b',
  'llama3.1', 'llama3.1:8b',
  'mistral',
];
const MAX_TEMPERATURE = 0.7;
const SAFE_TEMPERATURE = 0.2;

export const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b';

interface GenerateOptions {
  model: string;
  prompt: string;
  temperature?: number;
}

interface StreamOptions extends GenerateOptions {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export function isApprovedModel(model: string): boolean {
  return APPROVED_MODELS.includes(model);
}

function requestBody(model: string, prompt: string, temperature: number, stream: boolean): string {
  return JSON.stringify({ model, prompt, temperature: Math.min(temperature, MAX_TEMPERATURE), stream });
}

function postGenerate(body: string, onResponse: (res: http.IncomingMessage) => void): http.ClientRequest {
  const req = http.request(
    {
      host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    onResponse,
  );
  req.write(body);
  req.end();
  return req;
}

export function health(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

export function generate({ model, prompt, temperature = SAFE_TEMPERATURE }: GenerateOptions): Promise<string> {
  if (!isApprovedModel(model)) return Promise.reject(new Error(`Model not in allowlist: ${model}`));
  const body = requestBody(model, prompt, temperature, false);

  return new Promise((resolve, reject) => {
    const req = postGenerate(body, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve((JSON.parse(data) as { response?: string }).response || '');
        } catch {
          reject(new Error('Failed to parse Ollama response'));
        }
      });
    });
    req.on('error', reject);
  });
}

export function generateStream({ model, prompt, temperature = SAFE_TEMPERATURE, onToken, onDone, onError }: StreamOptions): void {
  if (!isApprovedModel(model)) {
    onError(new Error(`Model not in allowlist: ${model}`));
    return;
  }
  const body = requestBody(model, prompt, temperature, true);

  const req = postGenerate(body, (res) => {
    res.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        try {
          const parsed = JSON.parse(line) as { response?: string; done?: boolean };
          if (parsed.response) onToken(parsed.response);
          if (parsed.done) onDone();
        } catch {
          // half line from ollama, next chunk has the rest
        }
      }
    });
    res.on('end', onDone);
  });
  req.on('error', onError);
}
