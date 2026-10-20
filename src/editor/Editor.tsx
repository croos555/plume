import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { createState, spellcheckAttrs, spellcheckCompartment, type EditorHooks } from './setup'

interface Props extends EditorHooks {
  initialDoc: string
  onReady: (view: EditorView | null) => void
  onScroll: () => void
  onSelection: () => void
}

/** CodeMirror editor. Uncontrolled: the parent remounts it (key) to load another document. */
export function Editor(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const hooks = useRef(props)
  hooks.current = props
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: createState(props.initialDoc, {
        placeholder: props.placeholder,
        spellcheck: props.spellcheck,
        onChange: (doc) => hooks.current.onChange(doc),
        onLink: () => hooks.current.onLink(),
        onPaste: (e, v) => hooks.current.onPaste(e, v)
      }),
      dispatch: (tr, v) => {
        v.update([tr])
        if (tr.selection || tr.docChanged) hooks.current.onSelection()
      }
    })
    viewRef.current = view
    const onScroll = () => hooks.current.onScroll()
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
    props.onReady(view)
    view.focus()
    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll)
      props.onReady(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: spellcheckCompartment.reconfigure(spellcheckAttrs(props.spellcheck)) })
  }, [props.spellcheck])

  return <div className="editor-host" ref={host} />
}
