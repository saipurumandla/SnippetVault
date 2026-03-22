import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

vi.mock('@monaco-editor/react', () => ({
  // monaco need a real browser, a textarea is enough for tests
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={e => onChange?.(e.target.value)} />
  ),
}));
