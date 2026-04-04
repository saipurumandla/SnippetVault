import { marked, Renderer, type Tokens } from 'marked';

const renderer = new Renderer();

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

renderer.code = ({ text, lang }: Tokens.Code) => `<div class="md-code-block">
  <div class="md-code-header">
    <span class="md-code-lang">${lang || 'code'}</span>
    <button class="md-code-copy" type="button">Copy</button>
  </div>
  <pre><code>${escapeHtml(text)}</code></pre>
</div>`;

marked.use({ renderer, breaks: true, gfm: true });

export function renderMarkdown(text: string): string {
  // [snippet:N] become chips before marked see them
  const processed = (text || '').replace(
    /\[snippet:(\d+)\]/g,
    '<button class="snip-ref" data-snip-id="$1">#$1</button>',
  );
  return marked.parse(processed, { async: false });
}
