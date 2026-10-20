import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { message, open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'

import { api, errorMessage, isMac } from './lib/api'
import { setSystemLocale, strings, systemLang } from './lib/i18n'
import { getSettings, updateSettings, useSettings } from './lib/settings'
import { addRecent, getRecent, removeRecent } from './lib/recent'
import { countWords, firstHeading, renderMarkdown } from './lib/markdown'
import { basename, dirname, relativeTo, resolveFrom, stripExt } from './lib/path'
import { htmlToMarkdown, isRichHtml } from './lib/paste'
import { exportHtml } from './lib/exportHtml'
import {
  headingLevel,
  insertDivider,
  insertImage,
  insertLink,
  insertTable,
  selectedText,
  setHeading,
  toggleCode,
  toggleInline,
  toggleLinePrefix
} from './editor/commands'
import { redo, undo } from '@codemirror/commands'
import { Editor } from './editor/Editor'
import { TopBar, type MenuCommand } from './components/TopBar'
import { Toolbar, type ToolAction } from './components/Toolbar'
import { Preview } from './components/Preview'
import { Welcome } from './components/Welcome'
import { ImageDialog, LinkDialog } from './components/InsertDialogs'
import { SettingsDialog, useDefaultApp } from './components/SettingsDialog'
import { GuideDialog } from './components/GuideDialog'

interface Doc {
  /** Changes when another document is loaded, to remount the editor */
  key: number
  path: string | null
  /** Content as last saved: the document is "dirty" when the text differs */
  saved: string
  initial: string
}

type Dialog = null | 'link' | 'image' | 'settings' | 'guide'

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'txt']
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']
let docCounter = 0

export default function App() {
  const settings = useSettings()
  const [, setLocaleReady] = useState(false)
  const lang = settings.lang === 'system' ? systemLang() : settings.lang
  const t = strings(lang)

  const [doc, setDoc] = useState<Doc | null>(null)
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [heading, setHeadingState] = useState(0)
  const [recent, setRecentState] = useState(getRecent)
  const [dragging, setDragging] = useState(false)
  const [linkSeed, setLinkSeed] = useState('')

  const viewRef = useRef<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const shiftDown = useRef(false)

  const dirty = doc !== null && content !== doc.saved
  const docDir = doc?.path ? dirname(doc.path) : null
  const title = doc ? (doc.path ? basename(doc.path) : t.untitled) : null
  const showPreview = mode === 'read' || settings.showPreview

  // Latest values for event listeners registered once
  const live = useRef({ doc, content, dirty, mode, t })
  live.current = { doc, content, dirty, mode, t }

  // ---------- appearance ----------

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.style.setProperty('--text-size', `${settings.textSize}px`)
    root.dataset.font = settings.readingFont
  }, [lang, settings.textSize, settings.readingFont])

  useEffect(() => {
    getCurrentWindow()
      .setTitle(title ? `${dirty ? '• ' : ''}${title} — Plume` : 'Plume')
      .catch(() => {})
  }, [title, dirty])

  // ---------- documents ----------

  const refreshRecent = () => setRecentState(getRecent())

  const loadDoc = useCallback((path: string | null, text: string) => {
    setDoc({ key: ++docCounter, path, saved: text, initial: text })
    setContent(text)
    setMode(path === null || getSettings().openInEdit ? 'edit' : 'read')
    setHeadingState(0)
    if (path) {
      addRecent(path)
      setRecentState(getRecent())
    }
  }, [])

  /** This window holds nothing worth keeping: a document can be opened here instead of a new window */
  const isBlank = () => {
    const { doc, content } = live.current
    return doc === null || (doc.path === null && content.trim() === '')
  }

  const openPath = useCallback(
    async (path: string) => {
      if (!isBlank()) {
        if (live.current.doc?.path === path) return
        await api.openWindow(path)
        return
      }
      try {
        const file = await api.readFile(path)
        loadDoc(file.path, file.content)
      } catch (e) {
        const exists = await api.pathExists(path).catch(() => true)
        if (!exists) {
          removeRecent(path)
          refreshRecent()
        }
        const { t } = live.current
        await message(`${exists ? t.openError : t.fileMissing}\n\n${path}${exists ? `\n${errorMessage(e)}` : ''}`, {
          title: 'Plume',
          kind: 'error'
        })
      }
    },
    [loadDoc]
  )

  const openFiles = useCallback(
    async (paths: string[]) => {
      for (const p of paths) await openPath(p)
    },
    [openPath]
  )

  const chooseAndOpen = useCallback(async () => {
    const { t } = live.current
    const picked = await openDialog({
      multiple: true,
      filters: [
        { name: t.markdownFiles, extensions: MD_EXT },
        { name: t.allFiles, extensions: ['*'] }
      ]
    })
    if (picked) await openFiles(Array.isArray(picked) ? picked : [picked])
  }, [openFiles])

  const newDocument = useCallback(async () => {
    if (isBlank()) loadDoc(null, '')
    else await api.openWindow()
  }, [loadDoc])

  const saveAs = useCallback(async (): Promise<boolean> => {
    const { doc, content, t } = live.current
    if (!doc) return false
    const suggested = doc.path ?? `${firstHeading(content)?.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || t.untitled}.md`
    let path = await saveDialog({
      defaultPath: suggested,
      filters: [{ name: t.markdownFiles, extensions: ['md', 'markdown', 'txt'] }]
    })
    if (!path) return false
    if (!/\.[a-z0-9]+$/i.test(basename(path))) path += '.md'
    try {
      await api.writeFile(path, content)
    } catch (e) {
      await message(`${t.saveError}\n\n${errorMessage(e)}`, { title: 'Plume', kind: 'error' })
      return false
    }
    setDoc({ ...doc, path, saved: content })
    addRecent(path)
    refreshRecent()
    return true
  }, [])

  const save = useCallback(async (): Promise<boolean> => {
    const { doc, content, t } = live.current
    if (!doc) return false
    if (!doc.path) return saveAs()
    try {
      await api.writeFile(doc.path, content)
      setDoc((d) => (d && d.key === doc.key ? { ...d, saved: content } : d))
      return true
    } catch (e) {
      await message(`${t.saveError}\n\n${errorMessage(e)}`, { title: 'Plume', kind: 'error' })
      return false
    }
  }, [saveAs])

  // Autosave, a moment after the last keystroke
  useEffect(() => {
    if (!settings.autosave || !doc?.path || !dirty) return
    const timer = setTimeout(() => save(), 1200)
    return () => clearTimeout(timer)
  }, [settings.autosave, doc?.path, dirty, content, save])

  const exportAsHtml = useCallback(async () => {
    const { doc, content, t } = live.current
    if (!doc) return
    const name = stripExt(doc.path ? basename(doc.path) : t.untitled)
    const path = await saveDialog({
      defaultPath: doc.path ? `${dirname(doc.path)}/${name}.html` : `${name}.html`,
      filters: [{ name: t.htmlFiles, extensions: ['html'] }]
    })
    if (!path) return
    try {
      await api.exportFile(path, exportHtml(content, firstHeading(content) ?? name, lang, doc.path ? dirname(doc.path) : null))
    } catch (e) {
      await message(`${t.saveError}\n\n${errorMessage(e)}`, { title: 'Plume', kind: 'error' })
    }
  }, [lang])

  const print = useCallback(async () => {
    if (!live.current.doc) return
    // Prints the reading view
    setMode('read')
    await new Promise((r) => setTimeout(r, 150))
    await api.print().catch(() => window.print())
  }, [])

  // ---------- editing ----------

  const switchMode = useCallback((m: 'read' | 'edit') => {
    if (!live.current.doc) return
    setMode(m)
    if (m === 'edit') requestAnimationFrame(() => viewRef.current?.focus())
  }, [])

  /** Images go into an "images" folder next to the document, which must be saved first */
  const ensureSaved = useCallback(async (): Promise<string | null> => {
    const { doc } = live.current
    if (doc?.path) return doc.path
    const ok = await saveAs()
    return ok ? live.current.doc?.path ?? null : null
  }, [saveAs])

  const insertImageFile = useCallback(
    async (file: string, alt = '') => {
      const view = viewRef.current
      const docPath = await ensureSaved()
      if (!view || !docPath) return
      try {
        const dest = await api.copyImage(file, docPath)
        insertImage(view, alt || stripImageExt(basename(file)), relativeTo(dirname(docPath), dest))
      } catch (e) {
        await message(errorMessage(e), { title: 'Plume', kind: 'error' })
      }
    },
    [ensureSaved]
  )

  const pickImage = useCallback(
    async (alt: string) => {
      setDialog(null)
      const { t } = live.current
      const picked = await openDialog({ multiple: false, filters: [{ name: t.imageFiles, extensions: IMAGE_EXT }] })
      if (typeof picked === 'string') await insertImageFile(picked, alt)
    },
    [insertImageFile]
  )

  const onPaste = useCallback(
    (e: ClipboardEvent, view: EditorView): boolean => {
      const data = e.clipboardData
      if (!data) return false
      const image = Array.from(data.files).find((f) => f.type.startsWith('image/'))
      if (image && !data.getData('text/plain')) {
        e.preventDefault()
        pasteImage(image, view)
        return true
      }
      const html = data.getData('text/html')
      if (getSettings().smartPaste && !shiftDown.current && html && isRichHtml(html)) {
        const markdown = htmlToMarkdown(html)
        if (markdown) {
          e.preventDefault()
          view.dispatch(view.state.replaceSelection(markdown), { scrollIntoView: true, userEvent: 'input.paste' })
          return true
        }
      }
      return false
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const pasteImage = async (file: File, view: EditorView) => {
    const docPath = await ensureSaved()
    if (!docPath) return
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') || 'png'
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    try {
      const data = await fileToBase64(file)
      const dest = await api.saveImage(docPath, `image-${stamp}.${ext}`, data)
      insertImage(view, '', relativeTo(dirname(docPath), dest))
    } catch (e) {
      await message(errorMessage(e), { title: 'Plume', kind: 'error' })
    }
  }

  const onToolAction = useCallback((a: ToolAction) => {
    const view = viewRef.current
    if (!view) return
    const { t } = live.current
    switch (a) {
      case 'bold':
        return void toggleInline(view, '**')
      case 'italic':
        return void toggleInline(view, '_')
      case 'strike':
        return void toggleInline(view, '~~')
      case 'link':
        setLinkSeed(selectedText(view))
        return setDialog('link')
      case 'image':
        return setDialog('image')
      case 'bullet':
      case 'number':
      case 'task':
      case 'quote':
        return void toggleLinePrefix(view, a)
      case 'code':
        return void toggleCode(view)
      case 'table':
        return void insertTable(view, t.tableHeader, t.tableCell)
      case 'divider':
        return void insertDivider(view)
      case 'undo':
        undo(view)
        return view.focus()
      case 'redo':
        redo(view)
        return view.focus()
    }
  }, [])

  // ---------- preview ----------

  const deferred = useDeferredValue(content)
  const html = useMemo(() => (doc && showPreview ? renderMarkdown(deferred, { docDir }) : ''), [deferred, docDir, showPreview, doc])
  const words = useMemo(() => countWords(deferred), [deferred])

  /** Keeps the preview at the same place as the editor */
  const syncPreview = useCallback(() => {
    const view = viewRef.current
    const pv = previewRef.current
    if (!view || !pv || live.current.mode !== 'edit') return
    const sc = view.scrollDOM
    // Scrolled to the very end: show the end of the preview too
    if (sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
      pv.scrollTop = pv.scrollHeight
      return
    }
    const height = sc.getBoundingClientRect().top - view.documentTop
    const block = view.lineBlockAtHeight(Math.max(0, height))
    const line = view.state.doc.lineAt(block.from).number - 1
    const target = line + Math.min(1, Math.max(0, (height - block.top) / Math.max(1, block.height)))
    const marks: { line: number; top: number }[] = []
    const base = pv.getBoundingClientRect().top - pv.scrollTop
    let last = -1
    pv.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
      const l = Number(el.dataset.line)
      if (l > last) {
        marks.push({ line: l, top: el.getBoundingClientRect().top - base })
        last = l
      }
    })
    if (!marks.length) return
    let prev = { line: 0, top: 0 }
    let next = { line: view.state.doc.lines, top: pv.scrollHeight }
    for (const m of marks) {
      if (m.line <= target) prev = m
      else {
        next = m
        break
      }
    }
    const ratio = (target - prev.line) / Math.max(1, next.line - prev.line)
    pv.scrollTop = prev.top + (next.top - prev.top) * ratio - 24
  }, [])

  useEffect(() => {
    if (mode === 'edit') requestAnimationFrame(syncPreview)
  }, [html, mode, syncPreview])

  const toggleTask = (input: HTMLInputElement) => {
    const li = input.closest<HTMLElement>('[data-line]')
    const view = viewRef.current
    if (!li || !view) return
    const lineNo = Number(li.dataset.line) + 1
    if (lineNo < 1 || lineNo > view.state.doc.lines) return
    const line = view.state.doc.line(lineNo)
    const m = line.text.match(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/)
    if (!m) return
    const at = line.from + m[1].length + 1
    view.dispatch({ changes: { from: at, to: at + 1, insert: m[2] === ' ' ? 'x' : ' ' }, userEvent: 'input' })
  }

  const onPreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      e.preventDefault()
      toggleTask(target)
      return
    }
    const a = target.closest('a')
    if (!a) return
    e.preventDefault()
    const href = a.getAttribute('href') || ''
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1))
      previewRef.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (/^(https?|mailto|tel):/i.test(href)) {
      openUrl(href).catch(() => {})
    } else if (docDir && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      // Link to another document next to this one
      const file = resolveFrom(docDir, decodeURIComponent(href.split('#')[0]))
      if (/\.(md|markdown|mdown|mkd)$/i.test(file)) api.openWindow(file)
    }
  }

  // ---------- window, menu, shortcuts ----------

  const runCommand = useCallback(
    (c: string) => {
      switch (c) {
        case 'new':
          return void newDocument()
        case 'open':
          return void chooseAndOpen()
        case 'save':
          return void save()
        case 'save_as':
          return void saveAs()
        case 'export_html':
          return void exportAsHtml()
        case 'print':
          return void print()
        case 'mode_read':
          return switchMode('read')
        case 'mode_edit':
          return switchMode('edit')
        case 'toggle_preview':
          return updateSettings({ showPreview: !getSettings().showPreview })
        case 'settings':
          return setDialog('settings')
        case 'guide':
          return setDialog('guide')
        case 'quit':
          return void getCurrentWindow().close()
      }
    },
    [newDocument, chooseAndOpen, save, saveAs, exportAsHtml, print, switchMode]
  )
  const runRef = useRef(runCommand)
  runRef.current = runCommand

  // Startup: files handed to this window, menu events, close confirmation, drag and drop
  useEffect(() => {
    const win = getCurrentWebviewWindow()
    const unlisten: Promise<() => void>[] = []

    unlisten.push(win.listen<string[]>('open-files', (e) => openFiles(e.payload)))
    unlisten.push(win.listen<string>('menu', (e) => runRef.current(e.payload)))

    // Listen first: files opened from the system right after windowReady arrive as events
    Promise.all(unlisten)
      .then(() => api.windowReady())
      .then(async (startup) => {
        setSystemLocale(startup.locale)
        setLocaleReady(true)
        await openFiles(startup.files)
        if (startup.action) runRef.current(startup.action)
      })
      .finally(() => win.show())

    unlisten.push(
      win.onCloseRequested(async (e) => {
        const { doc, dirty, t } = live.current
        if (!dirty || !doc) return
        e.preventDefault()
        const name = doc.path ? basename(doc.path) : t.untitled
        const answer = await message(t.unsavedBody(name), {
          title: t.unsavedTitle,
          kind: 'warning',
          buttons: { yes: t.unsavedSave, no: t.unsavedDiscard, cancel: t.cancel }
        })
        if (answer === t.unsavedSave || answer === 'Yes') {
          if (await save()) await win.destroy()
          else api.cancelQuit()
        } else if (answer === t.unsavedDiscard || answer === 'No') {
          await win.destroy()
        } else {
          api.cancelQuit()
        }
      })
    )

    unlisten.push(
      getCurrentWebview().onDragDropEvent((e) => {
        const p = e.payload
        if (p.type === 'enter' || p.type === 'over') setDragging(true)
        else if (p.type === 'leave') setDragging(false)
        else if (p.type === 'drop') {
          setDragging(false)
          const docs = p.paths.filter((f) => new RegExp(`\\.(${MD_EXT.join('|')})$`, 'i').test(f))
          const images = p.paths.filter((f) => new RegExp(`\\.(${IMAGE_EXT.join('|')})$`, 'i').test(f))
          if (images.length && live.current.mode === 'edit' && viewRef.current) {
            ;(async () => {
              for (const img of images) await insertImageFile(img)
            })()
          }
          if (docs.length) openFiles(docs)
        }
      })
    )

    return () => {
      unlisten.forEach((u) => u.then((f) => f()).catch(() => {}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftDown.current = e.shiftKey
      // macOS: the application menu owns these shortcuts
      if (isMac) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'v') shiftDown.current = e.shiftKey
        return
      }
      if (!e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const map: Record<string, string> = {
        n: 'new',
        o: 'open',
        s: e.shiftKey ? 'save_as' : 'save',
        p: e.shiftKey ? 'toggle_preview' : 'print',
        '1': 'mode_read',
        '2': 'mode_edit',
        ',': 'settings'
      }
      const cmd = map[k]
      if (cmd) {
        e.preventDefault()
        runRef.current(cmd)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      shiftDown.current = e.shiftKey
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ---------- "open .md files with Plume" (asked once) ----------

  const { status: defaultApp, refresh: refreshDefaultApp } = useDefaultApp()
  const askDefaultApp = !settings.defaultAppAsked && defaultApp?.isDefault === false && import.meta.env.PROD

  const acceptDefaultApp = async () => {
    updateSettings({ defaultAppAsked: true })
    try {
      await api.makeMdDefault()
      await refreshDefaultApp()
    } catch (e) {
      await message(`${t.defaultAppError} ${errorMessage(e)}`, { title: 'Plume', kind: 'error' })
    }
  }

  // ---------- render ----------

  return (
    <div className={`app mode-${mode}${doc ? '' : ' no-doc'}`}>
      <TopBar
        t={t}
        title={title}
        dirty={dirty}
        hasPath={!!doc?.path}
        mode={mode}
        showPreview={settings.showPreview}
        onMode={switchMode}
        onTogglePreview={() => runCommand('toggle_preview')}
        onCommand={(c: MenuCommand) => runCommand(c)}
      />

      {askDefaultApp && (
        <div className="banner">
          <span>{t.defaultAppPrompt}</span>
          <button className="button primary" onClick={acceptDefaultApp}>
            {t.defaultAppYes}
          </button>
          <button className="button" onClick={() => updateSettings({ defaultAppAsked: true })}>
            {t.defaultAppLater}
          </button>
        </div>
      )}

      {doc && mode === 'edit' && (
        <Toolbar t={t} headingLevel={heading} onHeading={(l) => viewRef.current && setHeading(viewRef.current, l)} onAction={onToolAction} />
      )}

      <main className="workspace">
        {!doc && (
          <Welcome
            t={t}
            recent={recent}
            onNew={newDocument}
            onOpen={chooseAndOpen}
            onOpenPath={openPath}
            onForget={(p) => {
              removeRecent(p)
              refreshRecent()
            }}
          />
        )}
        {doc && (
          <>
            <section className="editor-pane" hidden={mode !== 'edit'}>
              <Editor
                key={doc.key}
                initialDoc={doc.initial}
                placeholder={t.newDocument + '…'}
                spellcheck={settings.spellcheck}
                onChange={setContent}
                onLink={() => {
                  if (viewRef.current) setLinkSeed(selectedText(viewRef.current))
                  setDialog('link')
                }}
                onPaste={onPaste}
                onReady={(v) => (viewRef.current = v)}
                onScroll={syncPreview}
                onSelection={() => viewRef.current && setHeadingState(headingLevel(viewRef.current.state))}
              />
            </section>
            {showPreview && (
              <section className="preview-pane">
                <Preview ref={previewRef} html={html} onClick={onPreviewClick} />
              </section>
            )}
          </>
        )}
        {dragging && <div className="drop-overlay" />}
      </main>

      {doc && (
        <footer className="statusbar">
          <span>{t.words(words)}</span>
          <span>{t.readingTime(Math.max(1, Math.round(words / 230)))}</span>
          {doc.path && <span className="statusbar-path" title={doc.path}>{dirname(doc.path)}</span>}
        </footer>
      )}

      {dialog === 'link' && (
        <LinkDialog
          t={t}
          initialText={linkSeed}
          onClose={() => setDialog(null)}
          onInsert={(text, url) => {
            setDialog(null)
            if (viewRef.current) insertLink(viewRef.current, text, url)
          }}
        />
      )}
      {dialog === 'image' && (
        <ImageDialog
          t={t}
          onClose={() => setDialog(null)}
          onPick={pickImage}
          onInsert={(alt, url) => {
            setDialog(null)
            if (viewRef.current) insertImage(viewRef.current, alt, url)
          }}
        />
      )}
      {dialog === 'settings' && <SettingsDialog t={t} onClose={() => setDialog(null)} />}
      {dialog === 'guide' && <GuideDialog t={t} lang={lang} onClose={() => setDialog(null)} />}
    </div>
  )
}

function stripImageExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
