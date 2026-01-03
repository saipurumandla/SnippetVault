import { marked, Renderer } from 'marked';

const renderer = new Renderer();

renderer.code = function(codeOrObj, langArg) {
  // marked v4+ passes an object; v2-v3 passes positional args
  let code = codeOrObj;
  let lang = langArg;
  if (codeOrObj && typeof codeOrObj === 'object') {
    code = codeOrObj.text;
    lang = codeOrObj.lang;
  }
  const label = lang || 'code';
  const escaped = String(code)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div class="md-code-block">
  <div class="md-code-header">
    <span class="md-code-lang">${label}</span>
    <button class="md-code-copy" type="button">Copy</button>
  </div>
  <pre><code>${escaped}</code></pre>
</div>`;
};

marked.use({ renderer, breaks: true, gfm: true });

export function renderMarkdown(text) {
  // convert [snippet:N] into clickable chips before markdown parsing
  const processed = (text || '').replace(
    /\[snippet:(\d+)\]/g,
    '<button class="snip-ref" data-snip-id="$1">↗ #$1</button>'
  );
  return marked.parse(processed);
}
