import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  placeholder,
  rectangularSelection
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { tags as t } from '@lezer/highlight'
import { toggleInline } from './commands'

// Markdown source styled to hint at the result: big headings, bold text in bold, discreet symbols.
const markdownStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', color: 'var(--text-strong)' },
  { tag: t.heading2, fontSize: '1.35em', fontWeight: '700', color: 'var(--text-strong)' },
  { tag: t.heading3, fontSize: '1.15em', fontWeight: '700', color: 'var(--text-strong)' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '700', color: 'var(--text-strong)' },
  { tag: t.strong, fontWeight: '700', color: 'var(--text-strong)' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--text-muted)', textDecoration: 'underline' },
  { tag: t.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--code-text)' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--syntax-mark)' },
  { tag: t.list, color: 'var(--accent)' }
])

const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-ui)',
    lineHeight: '1.65',
    padding: '28px 0 40vh'
  },
  '.cm-content': {
    maxWidth: '760px',
    margin: '0 auto',
    padding: '0 32px',
    caretColor: 'var(--accent)'
  },
  '.cm-line': { padding: '0' },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection) !important'
  },
  '.cm-placeholder': { color: 'var(--text-faint)', fontStyle: 'italic' },
  '.cm-selectionMatch': { backgroundColor: 'var(--match)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-search': { fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '8px 12px' },
  '.cm-search input, .cm-search button': { fontFamily: 'var(--font-ui)', fontSize: '13px' },
  '.cm-textfield': {
    border: '1px solid var(--border-strong)',
    borderRadius: '6px',
    padding: '4px 8px',
    background: 'var(--bg)',
    color: 'var(--text)'
  },
  '.cm-button': {
    backgroundImage: 'none',
    background: 'var(--button)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '4px 10px'
  },
  '.cm-searchMatch': { backgroundColor: 'var(--match)', borderRadius: '2px' },
  '.cm-searchMatch-selected': { backgroundColor: 'var(--match-strong)' }
})

export const spellcheckCompartment = new Compartment()

export function spellcheckAttrs(on: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: on ? 'true' : 'false', autocorrect: 'off', autocapitalize: 'sentences' })
}

export interface EditorHooks {
  placeholder: string
  spellcheck: boolean
  onChange: (doc: string) => void
  onLink: () => void
  onPaste: (e: ClipboardEvent, view: EditorView) => boolean
}

export function createState(doc: string, hooks: EditorHooks): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      indentOnInput(),
      search({ top: true }),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, addKeymap: true }),
      syntaxHighlighting(markdownStyle),
      placeholder(hooks.placeholder),
      spellcheckCompartment.of(spellcheckAttrs(hooks.spellcheck)),
      Prec.high(
        keymap.of([
          { key: 'Mod-b', run: (v) => toggleInline(v, '**') },
          { key: 'Mod-i', run: (v) => toggleInline(v, '_') },
          { key: 'Mod-Shift-x', run: (v) => toggleInline(v, '~~') },
          { key: 'Mod-k', run: () => (hooks.onLink(), true) }
        ])
      ),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) hooks.onChange(u.state.doc.toString())
      }),
      EditorView.domEventHandlers({
        paste: (e, view) => hooks.onPaste(e, view)
      }),
      baseTheme
    ]
  })
}
