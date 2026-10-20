import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

// Pasting from a web page, Word or Google Docs: their HTML becomes Markdown instead of losing formatting.

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined'
})
turndown.use(gfm)
turndown.remove(['script', 'style', 'meta', 'link', 'title', 'head'])
// Word wraps everything in <span style> and <o:p>: keep their content only
turndown.addRule('wordJunk', {
  filter: (node) => node.nodeName === 'O:P',
  replacement: (content) => content
})
// Google Docs wraps the whole selection in <b style="font-weight:normal">
turndown.addRule('gdocsWrapper', {
  filter: (node) => node.nodeName === 'B' && /font-weight:\s*normal/.test((node as HTMLElement).getAttribute('style') || ''),
  replacement: (content) => content
})

/** HTML worth converting: something more than a single run of plain text */
export function isRichHtml(html: string): boolean {
  return /<(h[1-6]|strong|b|em|i|a|ul|ol|li|table|blockquote|pre|code|img|hr)[\s>]/i.test(html)
}

export function htmlToMarkdown(html: string): string {
  const body = html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '')
  // Fragment markers some apps add around the copied part
  const fragment = body.replace(/<!--StartFragment-->|<!--EndFragment-->/g, '')
  return turndown
    .turndown(fragment)
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
