import markdownCss from '../styles/markdown.css?raw'
import { renderMarkdown } from './markdown'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** A standalone web page: the rendered document with its styles, light and dark */
export function exportHtml(source: string, title: string, lang: string, docDir: string | null): string {
  const body = renderMarkdown(source, { docDir, forExport: true })
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Plume">
<title>${escapeHtml(title)}</title>
<style>
${EXPORT_VARS}
${markdownCss}
body { margin: 0; background: var(--bg); color: var(--text); }
.markdown-body { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>
`
}

const EXPORT_VARS = `
:root {
  --text-size: 17px;
  --font-reading: Charter, 'Bitstream Charter', 'Iowan Old Style', Georgia, Cambria, 'Times New Roman', serif;
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  --bg: #ffffff; --text: #24292f; --text-strong: #111418; --text-muted: #5b636e; --border: #e3e5e8;
  --accent: #4f4fc9; --code-bg: #f3f4f6; --code-text: #b4235a; --quote-bar: #c9c9ef; --table-stripe: #f8f8fb;
  --hl-keyword: #8b2bb9; --hl-string: #0a7d3b; --hl-number: #b35900; --hl-comment: #7a828c; --hl-title: #2f5fc4;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17181c; --text: #d6d8dd; --text-strong: #f2f3f5; --text-muted: #9aa0aa; --border: #2e3038;
    --accent: #9c9cf5; --code-bg: #24262d; --code-text: #f28ab0; --quote-bar: #4a4a8a; --table-stripe: #1d1f24;
    --hl-keyword: #d49af5; --hl-string: #8fd6a2; --hl-number: #f2b170; --hl-comment: #8a919c; --hl-title: #8fb4ff;
  }
}`
