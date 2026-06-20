const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, label: 'openai-key' },
  { pattern: /(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,}/g, label: 'stripe-key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'github-token' },
  { pattern: /github_pat_[0-9A-Za-z_]{40,}/g, label: 'github-token' },
  { pattern: /AIza[0-9A-Za-z_-]{35}/g, label: 'google-key' },
  { pattern: /AKIA[0-9A-Z]{16}/g, label: 'aws-key' },
  { pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g, label: 'slack-token' },
  { pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, label: 'private-key' },
  { pattern: /(?<![a-zA-Z0-9])([a-f0-9]{64})(?![a-zA-Z0-9])/g, label: 'hex-secret' },
];

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /you\s+are\s+now\s+(an?\s+)?(admin|root|system|gpt|claude)/i,
  /disregard\s+(your\s+)?(guidelines|rules|instructions)/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+/i,
  /jailbreak/i,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, label } of SECRET_PATTERNS) {
    result = result.replace(pattern, `<${label.toUpperCase()}>`);
  }
  return result;
}

export function containsInjection(text: string): boolean {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function filterToken(token: string): string {
  return redactSecrets(token);
}

