import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Modal } from './Modal'
import type { Strings } from '../lib/i18n'

export function LinkDialog({
  t,
  initialText,
  onInsert,
  onClose
}: {
  t: Strings
  initialText: string
  onInsert: (text: string, url: string) => void
  onClose: () => void
}) {
  const looksLikeUrl = /^(https?:\/\/|www\.|mailto:)/i.test(initialText.trim())
  const [text, setText] = useState(looksLikeUrl ? '' : initialText)
  const [url, setUrl] = useState(looksLikeUrl ? initialText.trim() : '')

  const submit = () => {
    let u = url.trim()
    if (!u) return
    // People type "www.site.com" or "site.com": make it a real web address
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('#') && !u.startsWith('/') && !u.startsWith('.')) {
      u = u.includes('@') && !u.includes('/') ? `mailto:${u}` : `https://${u}`
    }
    onInsert(text.trim(), u)
  }

  return (
    <Modal
      title={t.linkTitle}
      onClose={onClose}
      footer={
        <>
          <button className="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="button primary" onClick={submit} disabled={!url.trim()}>
            {t.insert}
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="field">
          <span>{t.linkUrl}</span>
          <input
            type="text"
            value={url}
            placeholder={t.linkUrlPlaceholder}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <label className="field">
          <span>{t.linkText}</span>
          <input type="text" value={text} placeholder={url} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function ImageDialog({
  t,
  onPick,
  onInsert,
  onClose
}: {
  t: Strings
  onPick: (alt: string) => void
  onInsert: (alt: string, url: string) => void
  onClose: () => void
}) {
  const [alt, setAlt] = useState('')
  const [url, setUrl] = useState('')

  return (
    <Modal
      title={t.imageTitle}
      onClose={onClose}
      footer={
        <>
          <button className="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="button primary" disabled={!url.trim()} onClick={() => onInsert(alt.trim(), url.trim())}>
            {t.insert}
          </button>
        </>
      }
    >
      <div className="form">
        <button className="button big-choice" onClick={() => onPick(alt.trim())}>
          <FolderOpen size={20} />
          {t.imageChoose}
        </button>
        <label className="field">
          <span>{t.imageUrl}</span>
          <input
            type="text"
            value={url}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <label className="field">
          <span>{t.imageAlt}</span>
          <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} />
        </label>
      </div>
    </Modal>
  )
}
