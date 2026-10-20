import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getVersion } from '@tauri-apps/api/app'
import { Modal } from './Modal'
import { LANGS, type Lang, type Strings } from '../lib/i18n'
import { updateSettings, useSettings } from '../lib/settings'
import { api, errorMessage, type DefaultAppStatus } from '../lib/api'

const REPO = 'https://github.com/croos555/plume'

export function SettingsDialog({ t, onClose }: { t: Strings; onClose: () => void }) {
  const s = useSettings()
  const [version, setVersion] = useState('')

  useEffect(() => {
    getVersion().then(setVersion, () => {})
  }, [])

  return (
    <Modal title={t.settings} onClose={onClose} wide>
      <div className="settings">
        <section>
          <h3>{t.appearance}</h3>
          <div className="setting-row">
            <span>{t.theme}</span>
            <select value={s.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof s.theme })}>
              <option value="system">{t.themeSystem}</option>
              <option value="light">{t.themeLight}</option>
              <option value="dark">{t.themeDark}</option>
            </select>
          </div>
          <div className="setting-row">
            <span>{t.language}</span>
            <select value={s.lang} onChange={(e) => updateSettings({ lang: e.target.value as 'system' | Lang })}>
              <option value="system">{t.languageSystem}</option>
              {Object.entries(LANGS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <span>{t.textSize}</span>
            <div className="range">
              <span className="range-small">A</span>
              <input
                type="range"
                min={13}
                max={24}
                step={1}
                value={s.textSize}
                onChange={(e) => updateSettings({ textSize: Number(e.target.value) })}
              />
              <span className="range-big">A</span>
            </div>
          </div>
          <div className="setting-row">
            <span>{t.readingFont}</span>
            <select value={s.readingFont} onChange={(e) => updateSettings({ readingFont: e.target.value as typeof s.readingFont })}>
              <option value="serif">{t.fontSerif}</option>
              <option value="sans">{t.fontSans}</option>
            </select>
          </div>
        </section>

        <section>
          <h3>{t.editing}</h3>
          <Toggle label={t.openInEdit} hint={t.openInEditHint} value={s.openInEdit} onChange={(v) => updateSettings({ openInEdit: v })} />
          <Toggle label={t.autosave} hint={t.autosaveHint} value={s.autosave} onChange={(v) => updateSettings({ autosave: v })} />
          <Toggle label={t.spellcheck} value={s.spellcheck} onChange={(v) => updateSettings({ spellcheck: v })} />
          <Toggle label={t.smartPaste} hint={t.smartPasteHint} value={s.smartPaste} onChange={(v) => updateSettings({ smartPaste: v })} />
        </section>

        <section>
          <h3>{t.files}</h3>
          <DefaultAppSetting t={t} />
        </section>

        <section>
          <h3>{t.about}</h3>
          <p className="about">
            Plume {version} — {t.aboutText}
            <br />
            <a
              href={REPO}
              onClick={(e) => {
                e.preventDefault()
                openUrl(REPO)
              }}
            >
              {t.website}
            </a>
          </p>
        </section>
      </div>
    </Modal>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <div>
        <div>{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** "Open .md files with Plume": state and button, shared with the first-launch banner */
export function useDefaultApp() {
  const [status, setStatus] = useState<DefaultAppStatus | null>(null)
  const refresh = () => api.mdDefaultStatus().then(setStatus, () => setStatus(null))
  useEffect(() => {
    refresh()
    // Windows applies the choice in its own dialog: check again when the user comes back
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return { status, refresh }
}

function DefaultAppSetting({ t }: { t: Strings }) {
  const { status, refresh } = useDefaultApp()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const make = async () => {
    setMessage(null)
    try {
      await api.makeMdDefault()
      updateSettings({ defaultAppAsked: true })
      if (status?.method === 'direct') setMessage({ ok: true, text: t.defaultAppDone })
      await refresh()
    } catch (e) {
      setMessage({ ok: false, text: `${t.defaultAppError} ${errorMessage(e)}` })
    }
  }

  return (
    <div className="toggle-row">
      <div>
        <div>{t.defaultApp}</div>
        <div className="hint">{status?.method === 'dialog' ? t.defaultAppDialogHint : t.defaultAppHint}</div>
        {message && <div className={message.ok ? 'hint success' : 'hint error'}>{message.text}</div>}
      </div>
      {status?.isDefault ? (
        <span className="badge-ok">
          <Check size={14} /> {t.defaultAppIsDefault}
        </span>
      ) : (
        <button className="button" onClick={make}>
          {t.defaultAppMake}
        </button>
      )}
    </div>
  )
}
