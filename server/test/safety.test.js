import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../src/ai/safetyFilters.ts';

describe('secret redaction', () => {
  const cases = {
    'openai': 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx',
    'github classic': 'ghp_' + 'a'.repeat(36),
    'github fine grained': 'github_pat_' + 'A1b2'.repeat(12),
    'google': 'AIza' + 'Sy'.repeat(17) + 'x',
  };
  for (const [name, text] of Object.entries(cases)) {
    it(`catches ${name}`, () => expect(redactSecrets(text)).not.toBe(text));
  }

  // real looking fake keys are in test/.env.test, not in git
  const fromEnv = {
    'stripe live': process.env.TEST_STRIPE_LIVE_KEY,
    'stripe test': process.env.TEST_STRIPE_TEST_KEY,
    'stripe restricted': process.env.TEST_STRIPE_RESTRICTED_KEY,
    'aws': process.env.TEST_AWS_KEY_ID,
    'ssh private key': process.env.TEST_SSH_KEY_HEADER,
  };
  for (const [name, text] of Object.entries(fromEnv)) {
    it.skipIf(!text)(`catches ${name}`, () => expect(redactSecrets(text)).not.toBe(text));
  }

  it('leaves normal code alone', () => {
    const code = "const sk_count = 3;\nconst skLive = 'not a key';\nfetch('/api/skus')";
    expect(redactSecrets(code)).toBe(code);
  });
});
