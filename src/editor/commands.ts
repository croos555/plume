import { EditorSelection, type ChangeSpec, type EditorState, type Line } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

// Formatting commands behind the toolbar and the keyboard shortcuts.
// They write plain Markdown so the document stays readable in any other app.

/** Bold, italic, strikethrough, inline code: wraps the selection, or removes the marks if present */
export function toggleInline(view: EditorView, mark: string): boolean {
  const { state } = view
  const len = mark.length
  view.dispatch(
    state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to)
      const before = state.sliceDoc(range.from - len, range.from)
      const after = state.sliceDoc(range.to, range.to + len)
      // Marks just outside the selection: remove them
      if (before === mark && after === mark && !(mark === '*' && isBoldAround(state, range.from, range.to))) {
        return {
          changes: [
            { from: range.from - len, to: range.from, insert: '' },
            { from: range.to, to: range.to + len, insert: '' }
          ],
          range: EditorSelection.range(range.from - len, range.to - len)
        }
      }
      // Marks inside the selection: remove them
      if (text.length >= 2 * len && text.startsWith(mark) && text.endsWith(mark)) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(len, -len) },
          range: EditorSelection.range(range.from, range.to - 2 * len)
        }
      }
      if (range.empty) {
        // No selection: wrap the word under the cursor, or insert empty marks
        const word = state.wordAt(range.head)
        if (word) {
          return {
            changes: [
              { from: word.from, insert: mark },
              { from: word.to, insert: mark }
            ],
            range: EditorSelection.cursor(range.head + len)
          }
        }
        return {
          changes: { from: range.from, insert: mark + mark },
          range: EditorSelection.cursor(range.from + len)
        }
      }
      // Keep spaces outside the marks: "**word** " not "**word **"
      const lead = text.length - text.trimStart().length
      const trail = text.length - text.trimEnd().length
      const from = range.from + lead
      const to = range.to - trail
      return {
        changes: [
          { from, insert: mark },
          { from: to, insert: mark }
        ],
        range: EditorSelection.range(from + len, to + len)
      }
    })
  )
  view.focus()
  return true
}

function isBoldAround(state: EditorState, from: number, to: number): boolean {
  return state.sliceDoc(from - 2, from) === '**' && state.sliceDoc(to, to + 2) === '**' && state.sliceDoc(from - 3, from) !== '***'
}

function selectedLines(state: EditorState): Line[] {
  const lines: Line[] = []
  const seen = new Set<number>()
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number
    let last = state.doc.lineAt(r.to).number
    // A selection ending at the very start of a line does not include that line
    if (last > first && state.doc.line(last).from === r.to) last--
    for (let n = first; n <= last; n++) {
      if (!seen.has(n)) {
        seen.add(n)
        lines.push(state.doc.line(n))
      }
    }
  }
  return lines
}

const HEADING = /^(#{1,6})\s+/
const LIST = /^(\s*)([-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/
const QUOTE = /^>\s?/

export function headingLevel(state: EditorState): number {
  const line = state.doc.lineAt(state.selection.main.head)
  const m = line.text.match(HEADING)
  return m ? m[1].length : 0
}

/** Turns the current lines into a heading of the given level (0: normal text) */
export function setHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const changes: ChangeSpec[] = []
  for (const line of selectedLines(state)) {
    const m = line.text.match(HEADING)
    const prefix = level ? '#'.repeat(level) + ' ' : ''
    changes.push({ from: line.from, to: line.from + (m ? m[0].length : 0), insert: prefix })
  }
  view.dispatch(state.update({ changes, scrollIntoView: true }))
  view.focus()
  return true
}

export type ListKind = 'bullet' | 'number' | 'task' | 'quote'

function prefixOf(kind: ListKind, index: number): string {
  switch (kind) {
    case 'bullet':
      return '- '
    case 'number':
      return `${index + 1}. `
    case 'task':
      return '- [ ] '
    case 'quote':
      return '> '
  }
}

function hasKind(text: string, kind: ListKind): boolean {
  if (kind === 'quote') return QUOTE.test(text)
  const m = text.match(LIST)
  if (!m) return false
  const p = m[2]
  if (kind === 'task') return /\[[ xX]\]/.test(p)
  if (kind === 'number') return /^\d/.test(p)
  return /^[-*+]/.test(p) && !/\[[ xX]\]/.test(p)
}

/** Lists and quotes: adds the prefix to every selected line, or removes it when all have it */
export function toggleLinePrefix(view: EditorView, kind: ListKind): boolean {
  const { state } = view
  const lines = selectedLines(state).filter((l, _i, all) => all.length === 1 || l.text.trim() !== '')
  const remove = lines.every((l) => hasKind(l.text, kind))
  const changes: ChangeSpec[] = []
  lines.forEach((line, i) => {
    if (kind === 'quote') {
      const m = line.text.match(QUOTE)
      if (remove) changes.push({ from: line.from, to: line.from + (m ? m[0].length : 0), insert: '' })
      else changes.push({ from: line.from, insert: '> ' })
      return
    }
    const m = line.text.match(LIST)
    const indent = m ? m[1].length : line.text.length - line.text.trimStart().length
    const oldLen = m ? m[2].length : 0
    const from = line.from + indent
    // A heading turned into a list item loses its #
    const h = m ? null : line.text.slice(indent).match(HEADING)
    changes.push({ from, to: from + oldLen + (h ? h[0].length : 0), insert: remove ? '' : prefixOf(kind, i) })
  })
  view.dispatch(state.update({ changes, scrollIntoView: true }))
  view.focus()
  return true
}

/** Inserts a block (table, divider, code block) on its own lines, with blank lines around it */
export function insertBlock(view: EditorView, block: string, cursorOffset?: number): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.to)
  // An empty line is replaced; otherwise the block goes after the current line
  const empty = line.text.trim() === ''
  const from = empty ? line.from : line.to
  const to = line.to
  const prev = state.sliceDoc(Math.max(0, from - 2), from)
  const next = state.sliceDoc(to, to + 2)
  const before = from === 0 || prev.endsWith('\n\n') ? '' : prev.endsWith('\n') ? '\n' : '\n\n'
  const after = next === '' ? '\n' : next.startsWith('\n\n') ? '' : next.startsWith('\n') ? '\n' : '\n\n'
  view.dispatch({
    changes: { from, to, insert: before + block + after },
    selection: EditorSelection.cursor(from + before.length + (cursorOffset ?? block.length)),
    scrollIntoView: true
  })
  view.focus()
  return true
}

/** Code: inline code inside a line, a fenced block for several lines */
export function toggleCode(view: EditorView): boolean {
  const { state } = view
  const r = state.selection.main
  const multiline = state.doc.lineAt(r.from).number !== state.doc.lineAt(r.to).number
  if (!multiline && !(r.empty && state.doc.lineAt(r.head).text.trim() === '')) return toggleInline(view, '`')
  if (multiline) {
    const first = state.doc.lineAt(r.from)
    const last = state.doc.lineAt(r.to)
    view.dispatch({
      changes: [
        { from: first.from, insert: '```\n' },
        { from: last.to, insert: '\n```' }
      ],
      scrollIntoView: true
    })
    view.focus()
    return true
  }
  return insertBlock(view, '```\n\n```', 4)
}

export function insertDivider(view: EditorView): boolean {
  return insertBlock(view, '---')
}

export function insertTable(view: EditorView, header: string, cell: string): boolean {
  const h = [1, 2, 3].map((n) => `${header} ${n}`)
  const widths = h.map((x) => Math.max(x.length, cell.length))
  const row = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |'
  const table = [row(h), '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |', row(h.map(() => cell)), row(h.map(() => cell))].join('\n')
  return insertBlock(view, table, 2)
}

/** Replaces the selection with a link, or turns the selected text into a link */
export function insertLink(view: EditorView, text: string, url: string): void {
  const r = view.state.selection.main
  const label = text || url
  const insert = `[${label}](${encodeSpaces(url)})`
  view.dispatch({
    changes: { from: r.from, to: r.to, insert },
    selection: EditorSelection.cursor(r.from + insert.length),
    scrollIntoView: true
  })
  view.focus()
}

export function insertImage(view: EditorView, alt: string, src: string): void {
  const r = view.state.selection.main
  const line = view.state.doc.lineAt(r.from)
  const insert = `![${alt}](${encodeSpaces(src)})`
  // Images read best on their own line
  if (r.empty && line.text.trim() !== '' && r.from !== line.from) {
    insertBlock(view, insert)
    return
  }
  view.dispatch({
    changes: { from: r.from, to: r.to, insert },
    selection: EditorSelection.cursor(r.from + insert.length),
    scrollIntoView: true
  })
  view.focus()
}

function encodeSpaces(url: string): string {
  return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/** Text selected in the editor, used to prefill the link dialog */
export function selectedText(view: EditorView): string {
  const r = view.state.selection.main
  return view.state.sliceDoc(r.from, r.to)
}
