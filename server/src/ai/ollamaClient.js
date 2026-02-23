import http from 'http';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);

const APPROVED_MODELS = [
  'qwen3-coder:30b',
  'qwen2.5-coder', 'qwen2.5-coder:7b',
  'llama3.1', 'llama3.1:8b',
  'mistral',
];
const MAX_TEMPERATURE = 0.7;
const SAFE_TEMPERATURE = 0.2;

function isApprovedModel(model) {
  return APPROVED_MODELS.includes(model);
}

function clampTemperature(temp, max) {
  return Math.min(temp, max);
}

async function health() {
  return new Promise((resolve) => {
    const req = http.get({ host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function generate({ model, prompt, temperature = SAFE_TEMPERATURE, stream = false }) {
  if (!isApprovedModel(model)) throw new Error(`Model not in allowlist: ${model}`);
  const safeTemp = clampTemperature(temperature, MAX_TEMPERATURE);

  const body = JSON.stringify({ model, prompt, temperature: safeTemp, stream });

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || '');
          } catch { reject(new Error('Failed to parse Ollama response')); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function generateStream({ model, prompt, temperature = SAFE_TEMPERATURE, onToken, onDone, onError }) {
  if (!isApprovedModel(model)) { onError(new Error(`Model not in allowlist: ${model}`)); return; }
  const safeTemp = clampTemperature(temperature, MAX_TEMPERATURE);
  const body = JSON.stringify({ model, prompt, temperature: safeTemp, stream: true });

  const req = http.request(
    { host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => {
      res.on('data', chunk => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) onToken(parsed.response);
            if (parsed.done) onDone();
          } catch {}
        }
      });
      res.on('end', onDone);
    }
  );
  req.on('error', onError);
  req.write(body);
  req.end();
}

export { health, generate, generateStream, isApprovedModel, APPROVED_MODELS };