import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isAbsolute, resolveFrom } from './path'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // fall through to the default rendering
      }
    }
    return ''
  }
}).use(taskLists, { enabled: false, label: true })

// Source line of every block, used to keep the preview scrolled like the editor
md.core.ruler.push('source_lines', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.nesting !== -1 && token.block) {
      token.attrSet('data-line', String(token.map[0]))
    }
  }
})

// Heading ids, so that [links](#a-heading) jump inside the document
md.core.ruler.push('heading_ids', (state) => {
  const used = new Map<string, number>()
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue
    const text = tokens[i + 1]?.children?.map((c) => c.content).join('') ?? ''
    let slug = slugify(text)
    const n = used.get(slug) ?? 0
    used.set(slug, n + 1)
    if (n) slug = `${slug}-${n}`
    tokens[i].attrSet('id', slug)
  }
})

// Fenced code blocks keep their data-line on the <pre>
const fence = md.renderer.rules.fence!
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const html = fence(tokens, idx, options, env, self)
  const line = tokens[idx].attrGet('data-line')
  return line ? html.replace(/^<pre/, `<pre data-line="${line}"`) : html
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export interface RenderOptions {
  /** Folder of the document: relative images are loaded from there */
  docDir: string | null
  /** Exported HTML keeps image addresses as written in the document */
  forExport?: boolean
}

let currentOptions: RenderOptions = { docDir: null }

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src')
    if (src && !currentOptions.forExport) node.setAttribute('src', localImage(src, currentOptions.docDir))
    node.setAttribute('loading', 'lazy')
  }
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('rel', 'noopener noreferrer')
  }
  // Task list checkboxes: clickable in the app (they tick the box in the text), inert in exports
  if (node.tagName === 'INPUT') {
    if (currentOptions.forExport) node.setAttribute('disabled', '')
    else node.removeAttribute('disabled')
  }
})

/** Turns an image address from the document into one the webview can load */
function localImage(src: string, docDir: string | null): string {
  if (/^(https?:|data:|blob:|asset:|http:\/\/asset\.localhost)/i.test(src)) return src
  let path = src
  if (/^file:\/\//i.test(path)) {
    path = decodeURIComponent(path.replace(/^file:\/\/(localhost)?/i, ''))
    if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1)
  } else {
    try {
      path = decodeURI(path)
    } catch {
      // keep as written
    }
  }
  if (!isAbsolute(path)) {
    if (!docDir) return src
    path = resolveFrom(docDir, path)
  }
  return convertFileSrc(path)
}

export function renderMarkdown(source: string, options: RenderOptions): string {
  currentOptions = options
  const html = md.render(source)
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-line', 'target', 'checked'],
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|asset|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  })
  currentOptions = { docDir: null }
  return clean
}

/** First level-1 heading, used as the page title of exports */
export function firstHeading(source: string): string | null {
  const m = source.match(/^#\s+(.+)$/m)
  return m ? m[1].replace(/[*_`~]/g, '').trim() : null
}

export function countWords(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|\-]+/g, ' ')
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  return m ? m.length : 0
}
