import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Columns2,
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  MoreHorizontal,
  PanelRightClose,
  PencilLine,
  Printer,
  Save,
  Settings
} from 'lucide-react'
import type { Strings } from '../lib/i18n'
import { isMac, modKey } from '../lib/api'

export type MenuCommand = 'new' | 'open' | 'save' | 'save_as' | 'export_html' | 'print' | 'settings' | 'guide'

interface Props {
  t: Strings
  title: string | null
  dirty: boolean
  hasPath: boolean
  mode: 'read' | 'edit'
  showPreview: boolean
  onMode: (m: 'read' | 'edit') => void
  onTogglePreview: () => void
  onCommand: (c: MenuCommand) => void
}

export function TopBar({ t, title, dirty, hasPath, mode, showPreview, onMode, onTogglePreview, onCommand }: Props) {
  const hasDoc = title !== null
  return (
    <header className={`topbar${isMac ? ' topbar-mac' : ''}`} data-tauri-drag-region>
      <div className="topbar-left" data-tauri-drag-region>
        {hasDoc && (
          <div className="doc-title" data-tauri-drag-region>
            <span className="doc-name" data-tauri-drag-region>
              {title}
            </span>
            <span className={`doc-state${dirty ? ' dirty' : ''}`} data-tauri-drag-region>
              {dirty || !hasPath ? t.unsaved : t.saved}
            </span>
          </div>
        )}
      </div>

      {hasDoc && (
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === 'read'} className={mode === 'read' ? 'active' : ''} onClick={() => onMode('read')}>
            <BookOpen size={15} />
            {t.read}
          </button>
          <button role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => onMode('edit')}>
            <PencilLine size={15} />
            {t.edit}
          </button>
        </div>
      )}

      <div className="topbar-right" data-tauri-drag-region>
        {hasDoc && mode === 'edit' && (
          <button
            className="icon-button"
            onClick={onTogglePreview}
            title={showPreview ? t.hidePreview : t.showPreview}
            aria-label={showPreview ? t.hidePreview : t.showPreview}
          >
            {showPreview ? <PanelRightClose size={18} /> : <Columns2 size={18} />}
          </button>
        )}
        {hasDoc && (
          <button className={`button${dirty ? ' primary' : ''}`} onClick={() => onCommand('save')} title={`${t.save} (${modKey}S)`}>
            <Save size={15} />
            {t.save}
          </button>
        )}
        <Dropdown label={t.more} icon={<MoreHorizontal size={18} />}>
          {(close) => {
            const item = (c: MenuCommand, icon: ReactNode, label: string, shortcut?: string, disabled?: boolean) => (
              <button
                className="menu-item"
                disabled={disabled}
                onClick={() => {
                  close()
                  onCommand(c)
                }}
              >
                {icon}
                <span>{label}</span>
                {shortcut && <kbd>{shortcut}</kbd>}
              </button>
            )
            return (
              <>
                {item('new', <FilePlus2 size={16} />, t.newDocument, `${modKey}N`)}
                {item('open', <FolderOpen size={16} />, t.openDocument, `${modKey}O`)}
                {hasDoc && <div className="menu-sep" />}
                {hasDoc && item('save_as', <Save size={16} />, t.saveAs, `${modKey}⇧S`)}
                {hasDoc && item('export_html', <Download size={16} />, t.exportHtml)}
                {hasDoc && item('print', <Printer size={16} />, t.print, `${modKey}P`)}
                <div className="menu-sep" />
                {item('guide', <HelpCircle size={16} />, t.guide)}
                {item('settings', <Settings size={16} />, t.settings, `${modKey},`)}
              </>
            )
          }}
        </Dropdown>
      </div>
    </header>
  )
}

function Dropdown({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
      </button>
      {open && <div className="dropdown-menu">{children(() => setOpen(false))}</div>}
    </div>
  )
}
