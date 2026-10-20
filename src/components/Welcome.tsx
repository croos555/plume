import { FilePlus2, FileText, FolderOpen, X } from 'lucide-react'
import type { Strings } from '../lib/i18n'
import { basename, dirname } from '../lib/path'
import { modKey } from '../lib/api'
import logo from '../../build/icon.svg'

interface Props {
  t: Strings
  recent: string[]
  onNew: () => void
  onOpen: () => void
  onOpenPath: (path: string) => void
  onForget: (path: string) => void
}

export function Welcome({ t, recent, onNew, onOpen, onOpenPath, onForget }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <img className="welcome-logo" src={logo} alt="" />
        <h1>Plume</h1>
        <p className="welcome-tagline">{t.appTagline}</p>
        <div className="welcome-actions">
          <button className="welcome-action" onClick={onNew}>
            <FilePlus2 size={26} />
            <span>{t.newDocument}</span>
            <kbd>{modKey}N</kbd>
          </button>
          <button className="welcome-action" onClick={onOpen}>
            <FolderOpen size={26} />
            <span>{t.openDocument}</span>
            <kbd>{modKey}O</kbd>
          </button>
        </div>
        <h2 className="welcome-section">{t.recent}</h2>
        {recent.length === 0 ? (
          <p className="welcome-empty">{t.noRecent}</p>
        ) : (
          <ul className="recent">
            {recent.map((p) => (
              <li key={p}>
                <button className="recent-item" onClick={() => onOpenPath(p)} title={p}>
                  <FileText size={18} />
                  <span className="recent-name">{basename(p)}</span>
                  <span className="recent-dir">{dirname(p)}</span>
                </button>
                <button className="icon-button recent-forget" aria-label={t.close} onClick={() => onForget(p)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="welcome-hint">{t.dropHint}</p>
      </div>
    </div>
  )
}
