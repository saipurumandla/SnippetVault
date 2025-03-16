const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /you\s+are\s+now\s+(an?\s+)?(admin|root|system)/i,
  /bypass\s+(access|permission|auth)/i,
  /reveal\s+(system\s+prompt|instructions|secrets)/i,
  /print\s+all\s+(hidden|env|secret)/i,
  /exfiltrate/i,
];

const SECRET_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(ghp_[a-zA-Z0-9]{36})\b/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b([a-f0-9]{64})\b/g,
];

function checkPromptInjection(text) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: 'Prompt injection pattern detected' };
    }
  }
  return { blocked: false };
}

function redactSecrets(text) {
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '<REDACTED>');
  }
  return redacted;
}

function checkSensitiveAccess(snippet, userConsented) {
  if (snippet.encryption_mode === 'sensitive' && !userConsented) {
    return { blocked: true, reason: 'Sensitive snippet excluded — explicit consent required' };
  }
  return { blocked: false };
}

module.exports = { checkPromptInjection, redactSecrets, checkSensitiveAccess };
