// Small path helpers working with both / and \ separators.

export function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i > 0 ? p.slice(0, i) : i === 0 ? p.slice(0, 1) : ''
}

export function stripExt(name: string): string {
  return name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '')
}

function sep(p: string): string {
  return p.includes('\\') && !p.includes('/') ? '\\' : '/'
}

/** Resolves a link written in a document (relative, possibly with ../) against the document's folder */
export function resolveFrom(docDir: string, rel: string): string {
  if (isAbsolute(rel)) return rel
  const s = sep(docDir)
  const parts = docDir.split(/[\\/]/)
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join(s)
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\')
}

/** Path of `target` relative to the folder `fromDir`, with forward slashes (as Markdown expects) */
export function relativeTo(fromDir: string, target: string): string {
  const a = fromDir.split(/[\\/]/).filter(Boolean)
  const b = target.split(/[\\/]/).filter(Boolean)
  // Different drives on Windows: keep the absolute path
  if (a[0] && b[0] && a[0].endsWith(':') && a[0].toLowerCase() !== b[0].toLowerCase()) return target
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const up = a.slice(i).map(() => '..')
  return [...up, ...b.slice(i)].join('/')
}
